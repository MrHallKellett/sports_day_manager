export function findExistingStudent(students, name, year) {
    return students.find(
        s =>
            s.name.toLowerCase() === name.toLowerCase() &&
            s.year === year
    );
}