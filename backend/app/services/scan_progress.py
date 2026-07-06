class ScanProgressTracker:
    def __init__(self):
        self.is_scanning = False
        self.percentage = 0
        self.current_cve = ""

    def start_scan(self):
        self.is_scanning = True
        self.percentage = 0
        self.current_cve = ""

    def update_progress(self, percentage: int, current_cve: str = ""):
        self.percentage = max(0, min(100, percentage))
        self.current_cve = current_cve

    def end_scan(self):
        self.is_scanning = False
        self.percentage = 100
        self.current_cve = ""

tracker = ScanProgressTracker()
