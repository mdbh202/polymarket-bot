import json
import asyncio
import time
from pathlib import Path
from typing import List, Dict, Optional

from textual.app import App, ComposeResult
from textual.widgets import Header, Footer, Static, DataTable
from textual.containers import Container, Horizontal, Vertical, ScrollableContainer
from textual.reactive import reactive
from textual import work

# Configuration
PROJECT_ROOT = Path(__file__).parent.parent
OUTPUT_DIR = PROJECT_ROOT / "output"
LATEST_SCAN_PATH = OUTPUT_DIR / "latest_scan.json"
PREDICTIONS_PATH = OUTPUT_DIR / "predictions.jsonl"
TRADES_PATH = OUTPUT_DIR / "trades.jsonl"

class SystemStatus(Static):
    """A minimal horizontal status bar."""
    status_msg = reactive("Initializing...")
    data_age = reactive(0)
    resolved_count = reactive(0)
    brier_score = reactive(0.0)
    auto_enabled = reactive(False)

    def compose(self) -> ComposeResult:
        yield Static(id="status-text")
        yield Static(id="age-text")
        yield Static(id="resolved-text")
        yield Static(id="brier-text")
        yield Static(id="auto-text")

    def watch_status_msg(self, value: str) -> None:
        color = "green" if value == "Connected" else "red"
        self.query_one("#status-text").update(f"STATE: [{color}]{value}[/]")

    def watch_data_age(self, value: int) -> None:
        color = "#a7f3d0" if value < 60 else "#fca5a5"
        self.query_one("#age-text").update(f"AGE: [{color}]{value}s[/]")

    def watch_resolved_count(self, value: int) -> None:
        self.query_one("#resolved-text").update(f"RESOLVED: {value}")

    def watch_brier_score(self, value: float) -> None:
        self.query_one("#brier-text").update(f"BRIER: [#a7f3d0]{value:.4f}[/]")
    
    def watch_auto_enabled(self, value: bool) -> None:
        mode = "[#a7f3d0]ON[/]" if value else "[dim]OFF[/]"
        self.query_one("#auto-text").update(f"AUTO: {mode}")

class MarketCard(Static):
    """A minimalist card for Zen 2.0 with probability visualization."""
    market_data = reactive({})

    def render(self) -> str:
        m = self.market_data
        if not m: return "Loading..."

        question = m.get('question', 'Unknown Market')
        market_p = m.get('market_p', m.get('market_price', 0.5))
        true_p = m.get('predicted_p', m.get('true_probability', 0.5))
        ensemble = m.get('ensemble_breakdown', {})
        
        # Color coding for the edge
        edge = true_p - market_p
        edge_color = "#a7f3d0" if edge > 0.05 else "#94a3b8"
        
        # Status Badge
        status = "[#a7f3d0]✓ TRADE TRIGGERED[/] | " if m.get('is_recommended') else ""
        
        # Simple ASCII probability bar
        # [=====M-----T-----]
        bar_width = 20
        m_pos = int(market_p * bar_width)
        t_pos = int(true_p * bar_width)
        
        bar = ["-"] * bar_width
        bar[m_pos] = "[#fca5a5]M[/]"
        bar[t_pos] = "[#a7f3d0]T[/]"
        bar_str = "".join(bar)

        return (
            f"[b]{question}[/b]\n"
            f"[dim]Forecast:[/] [b]{true_p:.1%}[/]  [dim]Market:[/] {market_p:.1%}  [dim]Edge:[/] [{edge_color}]{edge:+.1%}[/]\n"
            f"[dim]P-Bar:[/] |{bar_str}|  [dim]Ensemble:[/] [B:{ensemble.get('bayesian', '?')} S:{ensemble.get('sentiment', '?')} D:{ensemble.get('domain', '?')}]"
        )

class PolymarketApp(App):
    """Zen 2.0 - Minimalist Polymarket Dashboard."""
    
    TITLE = "Polymarket Zen 2.0"
    SUB_TITLE = "Minimalist Prediction Engine"
    CSS_PATH = "dashboard.tcss"

    BINDINGS = [
        ("r", "refresh", "Refresh"),
        ("n", "niche_scan", "Niche Scan"),
        ("s", "standard_scan", "Standard Scan"),
        ("a", "toggle_auto", "Toggle Auto"),
        ("c", "clear_activity", "Clear Activity"),
        ("q", "quit", "Quit"),
    ]

    markets = reactive([])
    predictions = reactive([])
    trades = reactive([])
    auto_mode = reactive(False)
    auto_timer = None

    def action_clear_activity(self) -> None:
        """Truncate trades.jsonl and predictions.jsonl."""
        try:
            if TRADES_PATH.exists(): TRADES_PATH.write_text("")
            if PREDICTIONS_PATH.exists(): PREDICTIONS_PATH.write_text("")
            self.notify("Activity logs cleared.")
            self.refresh_data()
        except Exception as e:
            self.notify(f"Clear Failed: {str(e)}", severity="error")

    def action_toggle_auto(self) -> None:
        self.auto_mode = not self.auto_mode
        self.query_one("#status-widget").auto_enabled = self.auto_mode
        if self.auto_mode:
            self.notify("Auto Mode ENABLED (15m interval)")
            self.action_niche_scan()
        else:
            self.notify("Auto Mode DISABLED")

    def check_auto_scan(self) -> None:
        """Periodic check to trigger auto scans."""
        if not self.auto_mode:
            return
            
        # Get age of latest scan
        scan_files = list(OUTPUT_DIR.glob("scan_*.json"))
        scan_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
        
        if not scan_files:
            self.action_niche_scan()
            return

        age = time.time() - scan_files[0].stat().st_mtime
        if age > 900: # 15 minutes
            self.action_niche_scan()

    async def action_niche_scan(self) -> None:
        self.notify("Launching Niche Scan (Edge 1 & 2)...")
        # Run in background
        asyncio.create_task(self.run_scan("bash scripts/scan_niche.sh"))

    async def action_standard_scan(self) -> None:
        self.notify("Launching Standard Scan...")
        asyncio.create_task(self.run_scan("bash scripts/scan.sh"))

    async def run_scan(self, cmd: str) -> None:
        process = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()
        self.notify("Scan Complete")
        self.refresh_data()
    
    def compose(self) -> ComposeResult:
        yield Header()
        with Container(id="status-bar"):
            yield SystemStatus(id="status-widget")
        with Vertical(id="main"):
            yield Static("Market Opportunities", classes="section-title")
            yield ScrollableContainer(id="market-list")
            yield Static("Recent Activity", classes="section-title")
            yield DataTable(id="trade-table")
        yield Footer()

    def on_mount(self) -> None:
        table = self.query_one("#trade-table", DataTable)
        table.add_columns("Time", "Side", "Amount", "Status", "Message")
        self.set_interval(5, self.refresh_data)
        self.set_interval(60, self.check_auto_scan)
        self.refresh_data()

    def action_refresh(self) -> None:
        self.refresh_data()

    @work(exclusive=True)
    async def refresh_data(self) -> None:
        try:
            # 1. Load Market Data (scan_niche results)
            scan_files = list(OUTPUT_DIR.glob("scan_*.json"))
            scan_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
            
            scanned_data = []
            age = 0
            if scan_files:
                try:
                    with open(scan_files[0], 'r') as f:
                        raw = json.load(f)
                        # We use 'predictions' as the primary source for the grid to show ALL analyzed markets
                        scanned_data = raw.get('predictions', []) or raw.get('markets', [])
                    age = int(time.time() - scan_files[0].stat().st_mtime)
                except: pass

            # 2. Load Calibration
            predictions_data = []
            total_brier = 0.0
            resolved = 0
            if PREDICTIONS_PATH.exists():
                with open(PREDICTIONS_PATH, 'r') as f:
                    for line in f:
                        if line.strip():
                            try:
                                pred = json.loads(line)
                                if pred.get('brier_score') is not None:
                                    total_brier += pred['brier_score']
                                    resolved += 1
                            except: continue

            # 3. Load Trades
            trades_data = []
            if TRADES_PATH.exists():
                with open(TRADES_PATH, 'r') as f:
                    for line in f:
                        if line.strip():
                            try: trades_data.append(json.loads(line))
                            except: continue
            trades_data.sort(key=lambda x: x.get('timestamp', ''), reverse=True)

            # Update State
            widget = self.query_one("#status-widget", SystemStatus)
            widget.status_msg = "Connected"
            widget.data_age = age
            widget.resolved_count = resolved
            widget.brier_score = total_brier / resolved if resolved > 0 else 0.0

            # Update Grid
            grid = self.query_one("#market-list", ScrollableContainer)
            grid.remove_children()
            for m in scanned_data[:20]: # Show top 20 analyzed
                card = MarketCard()
                card.market_data = m
                grid.mount(card)

            # Update Table
            table = self.query_one("#trade-table", DataTable)
            table.clear()
            for t in trades_data[:5]:
                ts = t.get('timestamp', '').split('T')[-1][:8]
                side = f"[#a7f3d0]BUY[/]" if t.get('side') == "BUY" else f"[#fca5a5]SELL[/]"
                status = f"[#a7f3d0]OK[/]" if t.get('status') == "SUCCESS" else f"[#fca5a5]FAIL[/]"
                msg = t.get('reason', '') or t.get('order_id', '')[:10]
                table.add_row(ts, side, f"${t.get('amount_usdc', 0):.1f}", status, msg)
                
        except Exception as e:
            self.notify(f"UI Error: {str(e)}", severity="error")

if __name__ == "__main__":
    app = PolymarketApp()
    app.run()
