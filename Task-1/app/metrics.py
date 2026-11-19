import threading
from collections import Counter

_lock = threading.Lock()
_counters: Counter = Counter()


def inc(name: str, **labels: str) -> None:
    label_text = ",".join(f'{k}="{v}"' for k, v in sorted(labels.items()))
    key = f"{name}{{{label_text}}}" if label_text else name
    with _lock:
        _counters[key] += 1


def render(gauges: dict[str, int]) -> str:
    with _lock:
        lines = [f"{key} {value}" for key, value in sorted(_counters.items())]
    lines += [f"{name} {value}" for name, value in sorted(gauges.items())]
    return "\n".join(lines) + "\n"
