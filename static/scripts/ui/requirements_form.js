export function addHouse() {
    const houseNames = document.getElementById("houseNameContainer");

    // Count existing houses to determine the next house number
    const houseCount = houseNames.children.length + 1;
    
    // Create label element
    const label = document.createElement("label");
    label.textContent = `House ${houseCount} Name: `;
    
    // Create input element
    const input = document.createElement("input");
    input.id = `house${houseCount}`;
    input.className = "w-full border rounded px-3 py-2";
    
    // Append input to label
    label.appendChild(input);
    
    // Append label to container
    houseNames.appendChild(label);

    return input;
}

export function populateHouseInputs(houses) {
    const existingInputs = Array.from(document.querySelectorAll("#houseNameContainer input"));

    houses.forEach((house, index) => {
        if (index < existingInputs.length) {
            existingInputs[index].value = house;
        } else {
            const newInput = addHouse();
            newInput.value = house;
        }
    });
}


// static/scripts/ui/forms.js

export function getHouses() {
    return Array.from(
        document.querySelectorAll("#houseNameContainer input")
    )
        .map(i => i.value.trim())
        .filter(Boolean);
}

export function getSelectedYearGroups() {
    const selected = [];

    document
        .querySelectorAll(".yearGroup:checked")
        .forEach(cb => {
            const y = parseInt(cb.value);

            if (
                (y === 10 || y === 11) && combineKS4.checked ||
                (y === 12 || y === 13) && combineKS5.checked
            ) return;

            selected.push(y);
        });

    if (combineKS4.checked) selected.push("KS4");
    if (combineKS5.checked) selected.push("KS5");

    return selected;
}
