import asyncio
import os

import click
from rich.console import Console
from rich.table import Table

from circus.config import Config
from circus.device.pool import DevicePool
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
