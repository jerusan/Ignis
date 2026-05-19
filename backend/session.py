"""In-memory session workbench — tracks per-session welding context."""

_sessions: dict[str, dict] = {}

_DEFAULT: dict = {
    "process": None,        # MIG | flux_cored | TIG | Stick
    "voltage": None,        # 120V | 240V
    "material": None,       # mild_steel | stainless | aluminum
    "thickness": None,      # e.g. "1/8 inch"
    "wire_size": None,      # e.g. "0.030\""
    "current_diagnostic_tree": None,
    "current_diagnostic_node": None,
}


def get_session(session_id: str) -> dict:
    if session_id not in _sessions:
        _sessions[session_id] = dict(_DEFAULT)
    return _sessions[session_id]


def update_session(session_id: str, **kwargs) -> None:
    s = get_session(session_id)
    for k, v in kwargs.items():
        if k in _DEFAULT:
            s[k] = v


def clear_diagnostic(session_id: str) -> None:
    update_session(session_id, current_diagnostic_tree=None, current_diagnostic_node=None)
