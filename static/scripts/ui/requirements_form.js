function addHouse() {
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
    
}

function populateHouseInputs(houses) {
    const inputs = document.querySelectorAll("#houseNameContainer input");
    
    // Populate the first two default fields
    houses.forEach((house, index) => {
        if (index < 2) {
            // Fill existing fields
            inputs[index].value = house;
        }
        else {
            // Add new fields for additional houses
            addHouse();
            // Get the newly added input and set its value
            const newInputs = document.querySelectorAll("#houseNameContainer input");
            newInputs[newInputs.length - 1].value = house;
        }
    });
}


// static/scripts/ui/forms.js

function getHouses() {
    return Array.from(
        document.querySelectorAll("#houseNameContainer input")
    )
        .map(i => i.value.trim())
        .filter(Boolean);
}

function getSelectedYearGroups() {
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