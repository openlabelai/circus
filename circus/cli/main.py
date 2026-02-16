import asyncio
import os

import click
from rich.console import Console
from rich.table import Table

from circus.config import Config
from circus.device.pool import DevicePool
from circus.persona.generator import generate_personas
from circus.persona.storage import PersonaStore
from circus.tasks.executor import ParallelExecutor
from circus.tasks.models import Task
from circus.tasks.results import ResultStore
from circus.tasks.runner import TaskRunner

console = Console()

_pool: DevicePool | None = None


def _get_pool() -> DevicePool:
    global _pool
    if _pool is None:
        _pool = DevicePool()
    return _pool


@click.group()
def cli() -> None:
    """Circus - Agentic phone farm CLI."""


@cli.command()
def devices() -> None:
    """List connected devices and their status."""

    async def _run() -> None:
        pool = _get_pool()
        devs = await pool.refresh()

        table = Table(title="Devices")
        table.add_column("Serial", style="cyan")
        table.add_column("Model")
        table.add_column("Brand")
        table.add_column("Android")
        table.add_column("Status", style="bold")

        for d in devs:
            status_style = {
                "available": "green",
                "busy": "yellow",
                "error": "red",
                "offline": "dim",
            }.get(d.status.value, "")

            table.add_row(
                d.serial,
                d.info.model if d.info else "?",
                d.info.brand if d.info else "?",
                d.info.android_version if d.info else "?",
                f"[{status_style}]{d.status.value}[/{status_style}]",
            )

        console.print(table)
        if not devs:
            console.print("[dim]No devices found. Check USB connections and ADB.[/dim]")

    asyncio.run(_run())


@cli.command(name="run")
@click.argument("task_file")
@click.option("--device", "-d", default=None, help="Device serial (default: any available)")
@click.option("--no-save", is_flag=True, default=False, help="Skip saving result to disk")
def run_task(task_file: str, device: str | None, no_save: bool) -> None:
    """Run a task from a YAML file on a device."""

    async def _run() -> None:
        config = Config()
        pool = _get_pool()
        await pool.refresh()

        task = Task.from_yaml(task_file)
        runner = TaskRunner(pool, config)

        console.print(f"Running task [bold]{task.name}[/bold]...")
        result = await runner.run(task, serial=device)

        if result.success:
            console.print(
                f"[green]Completed in {result.duration:.1f}s "
                f"({result.actions_completed} actions)[/green]"
            )
        else:
            console.print(f"[red]Failed: {result.error}[/red]")
            console.print(
                f"  Completed {result.actions_completed}/{result.actions_total} actions"
            )

        if not no_save:
            store = ResultStore(config.results_dir)
            path = store.save(result)
            console.print(f"  Result saved: [cyan]{path}[/cyan]")

        if result.screenshots:
            os.makedirs(config.screenshot_dir, exist_ok=True)
            for i, img in enumerate(result.screenshots):
                path = os.path.join(
                    config.screenshot_dir,
                    f"{task.name}_{i}.png",
                )
                img.save(path)
                console.print(f"  Screenshot saved: [cyan]{path}[/cyan]")

    asyncio.run(_run())


@cli.command(name="run-all")
@click.argument("task_file")
@click.option("--devices", "-d", default=None, help="Comma-separated device serials to target")
@click.option("--no-save", is_flag=True, default=False, help="Skip saving results to disk")
def run_all(task_file: str, devices: str | None, no_save: bool) -> None:
    """Run a task on all available devices in parallel."""

    async def _run() -> None:
        config = Config()
        pool = _get_pool()
        device_filter = devices.split(",") if devices else None

        executor = ParallelExecutor(pool, config, store_results=not no_save)
        task = Task.from_yaml(task_file)

        console.print(f"Running task [bold]{task.name}[/bold] on all devices...")
        summary = await executor.run_on_all(task, device_filter=device_filter)

        if not summary.results:
            console.print("[yellow]No available devices found.[/yellow]")
            return

        table = Table(title="Results")
        table.add_column("Device", style="cyan")
        table.add_column("Status")
        table.add_column("Actions")
        table.add_column("Duration")
        table.add_column("Error")

        for r in summary.results:
            status_str = "[green]OK[/green]" if r.success else "[red]FAIL[/red]"
            table.add_row(
                r.device_serial,
                status_str,
                f"{r.actions_completed}/{r.actions_total}",
                f"{r.duration:.1f}s",
                r.error or "",
            )

        console.print(table)
        console.print(
            f"[bold]{summary.successful}/{summary.total_devices} succeeded[/bold] "
            f"in {summary.duration:.1f}s"
        )

    asyncio.run(_run())


@cli.command()
@click.option("--date", "date_str", default=None, help="Date in YYYY-MM-DD format (default: today)")
def results(date_str: str | None) -> None:
    """Show stored task results."""
    from datetime import date

    config = Config()
    store = ResultStore(config.results_dir)
    target_date = date_str or date.today().isoformat()
    records = store.load_date(target_date)

    if not records:
        console.print(f"[dim]No results found for {target_date}[/dim]")
        return

    table = Table(title=f"Results — {target_date}")
    table.add_column("Time", style="dim")
    table.add_column("Task ID", style="cyan")
    table.add_column("Device", style="cyan")
    table.add_column("Status")
    table.add_column("Actions")
    table.add_column("Duration")
    table.add_column("Error")

    for rec in records:
        ts = rec["timestamp"]
        # Show just the time portion
        time_str = ts.split("T")[1][:8] if "T" in ts else ts
        status_str = "[green]OK[/green]" if rec["success"] else "[red]FAIL[/red]"
        table.add_row(
            time_str,
            rec["task_id"],
            rec["device_serial"],
            status_str,
            f"{rec['actions_completed']}/{rec['actions_total']}",
            f"{rec['duration']}s",
            rec.get("error") or "",
        )

    console.print(table)
    console.print(f"[bold]{len(records)} result(s)[/bold]")


@cli.command()
def status() -> None:
    """Show device pool status summary."""

    async def _run() -> None:
        pool = _get_pool()
        await pool.refresh()
        devs = pool.list_all()

        counts: dict[str, int] = {}
        for d in devs:
            counts[d.status.value] = counts.get(d.status.value, 0) + 1

        console.print(f"[bold]Total devices:[/bold] {len(devs)}")
        for s, count in sorted(counts.items()):
            console.print(f"  {s}: {count}")

    asyncio.run(_run())


@cli.command()
@click.argument("directory", default="./tasks")
def tasks(directory: str) -> None:
    """List available task files in a directory."""
    if not os.path.isdir(directory):
        console.print(f"[red]Directory not found: {directory}[/red]")
        return

    table = Table(title="Tasks")
    table.add_column("File", style="cyan")
    table.add_column("Name")
    table.add_column("Description")

    for f in sorted(os.listdir(directory)):
        if f.endswith((".yaml", ".yml")):
            try:
                task = Task.from_yaml(os.path.join(directory, f))
                table.add_row(f, task.name, task.description)
            except Exception as e:
                table.add_row(f, "[red]ERROR[/red]", str(e))

    console.print(table)


# -- Persona commands --


@cli.group()
def persona() -> None:
    """Manage synthetic personas."""


@persona.command(name="generate")
@click.option("-n", "--count", default=1, help="Number of personas to generate")
@click.option(
    "--services", default=None, help="Comma-separated services (e.g. instagram,tiktok)"
)
@click.option("--niche", default=None, help="Niche for all generated personas (e.g. fitness)")
@click.option("--tone", default=None, help="Tone for all generated personas (e.g. casual)")
def persona_generate(count: int, services: str | None, niche: str | None, tone: str | None) -> None:
    """Generate synthetic personas."""
    svc_list = services.split(",") if services else None
    config = Config()
    store = PersonaStore(config.persona_dir)
    personas = generate_personas(count, services=svc_list, niche=niche, tone=tone)
    for p in personas:
        path = store.save(p)
        console.print(f"  [green]+[/green] {p.id} — {p.name} [{p.niche}/{p.tone}] -> {path}")
    console.print(f"[bold]Generated {count} persona(s)[/bold]")


@persona.command(name="list")
def persona_list() -> None:
    """List all personas and their device assignments."""
    config = Config()
    store = PersonaStore(config.persona_dir)
    personas = store.list_all()
    assignments = store.get_assignments()

    table = Table(title="Personas")
    table.add_column("ID", style="cyan")
    table.add_column("Name")
    table.add_column("Age")
    table.add_column("Niche")
    table.add_column("Username")
    table.add_column("Services")
    table.add_column("Device", style="yellow")

    for p in personas:
        device = assignments.get(p.id, "-")
        svcs = ", ".join(p.credentials.keys()) if p.credentials else "-"
        table.add_row(p.id, p.name, str(p.age), p.niche or "-", p.username, svcs, device)

    console.print(table)
    if not personas:
        console.print(
            "[dim]No personas found. Run 'circus persona generate' first.[/dim]"
        )


@persona.command(name="show")
@click.argument("persona_id")
def persona_show(persona_id: str) -> None:
    """Show full details for a persona."""
    import yaml

    config = Config()
    store = PersonaStore(config.persona_dir)
    try:
        p = store.load(persona_id)
    except FileNotFoundError:
        console.print(f"[red]Persona not found: {persona_id}[/red]")
        return

    device = store.get_device_for_persona(persona_id)
    console.print(f"[bold]Persona: {p.id}[/bold]")
    if device:
        console.print(f"[yellow]Assigned to device: {device}[/yellow]")
    else:
        console.print("[dim]Not assigned to any device[/dim]")
    console.print(yaml.dump(p.to_dict(), default_flow_style=False, sort_keys=False))


@persona.command(name="assign")
@click.argument("persona_id")
@click.argument("device_serial")
def persona_assign(persona_id: str, device_serial: str) -> None:
    """Assign a persona to a device."""
    config = Config()
    store = PersonaStore(config.persona_dir)
    try:
        store.assign(persona_id, device_serial)
        console.print(f"[green]Assigned {persona_id} -> {device_serial}[/green]")
    except (FileNotFoundError, ValueError) as e:
        console.print(f"[red]{e}[/red]")


@persona.command(name="unassign")
@click.argument("persona_id")
def persona_unassign(persona_id: str) -> None:
    """Remove persona-device assignment."""
    config = Config()
    store = PersonaStore(config.persona_dir)
    try:
        store.unassign(persona_id)
        console.print(f"[green]Unassigned {persona_id}[/green]")
    except KeyError as e:
        console.print(f"[red]{e}[/red]")
