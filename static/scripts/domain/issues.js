// static/scripts/domain/issues.js

function indexIssues(issues = []) {
    const map = {};
    for (const i of issues) {
        map[i.name] = i;
    }
    return map;
}