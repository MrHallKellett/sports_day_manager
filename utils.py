def year_to_groups(year: int) -> set[str]:
    """
    Convert a concrete year (e.g. 10) into all valid year-group labels.
    """
    groups = {str(year)}

    if year in (10, 11):
        groups.add("KS4")

    if year in (12, 13):
        groups.add("KS5")

    return groups