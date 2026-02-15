import asyncio
import os

import click
from rich.console import Console
from rich.table import Table

from circus.config import Config
from circus.device.pool import DevicePool
from circus.persona.generator import generate_personas
from circus.persona.storage import PersonaStore
from circus.tasks.models import Task
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
def run_task(task_file: str, device: str | None) -> None:
    """Run a task from a YAML file on a device."""

    async def _run() -> None:
        pool = _get_pool()
        await pool.refresh()

        task = Task.from_yaml(task_file)
        runner = TaskRunner(pool)

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

        if result.screenshots:
            config = Config()
            os.makedirs(config.screenshot_dir, exist_ok=True)
            for i, img in enumerate(result.screenshots):
                path = os.path.join(
                    config.screenshot_dir,
                    f"{task.name}_{i}.png",
                )
                img.save(path)
                console.print(f"  Screenshot saved: [cyan]{path}[/cyan]")

    asyncio.run(_run())


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
def persona_generate(count: int, services: str | None) -> None:
    """Generate synthetic personas."""
    svc_list = services.split(",") if services else None
    config = Config()
    store = PersonaStore(config.persona_dir)
    personas = generate_personas(count, services=svc_list)
    for p in personas:
        path = store.save(p)
        console.print(f"  [green]+[/green] {p.id} — {p.name} -> {path}")
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
    table.add_column("Username")
    table.add_column("Services")
    table.add_column("Device", style="yellow")

    for p in personas:
        device = assignments.get(p.id, "-")
        svcs = ", ".join(p.credentials.keys()) if p.credentials else "-"
        table.add_row(p.id, p.name, str(p.age), p.username, svcs, device)

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
