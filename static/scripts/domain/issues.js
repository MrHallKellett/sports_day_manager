// static/scripts/domain/issues.js

export function indexIssues(issues = []) {
    const map = {};
    for (const i of issues) {
        map[i.name] = i;
    }
    return map;
}