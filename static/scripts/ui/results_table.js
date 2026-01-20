// static/scripts/ui/results_table.js

import { fetchEventResults, startRace, finishRace, updateResult } from '../api/events.js';
import { showToast } from './toast.js';
import { showError, showConfirm } from './feedback.js';

export async function setupResultsTab(assignedEvents, code, containerElementId = 'event-results-container', selectElementId = 'event-results-select') {
    const eventSelect = document.getElementById(selectElementId);
    const resultsContainer = document.getElementById(containerElementId);

    if (!eventSelect || !resultsContainer) {
        console.error('Results tab elements not found');
        return;
    }

    if (!assignedEvents || assignedEvents.length === 0) {
        eventSelect.classList.add('hidden');
        resultsContainer.innerHTML = '<p class="text-gray-500">No events available.</p>';
        return;
    }

    eventSelect.innerHTML = '<option value="">Select an event...</option>';
    assignedEvents.forEach(event => {
        const option = new Option(`Y${event.year_group} ${event.name}`, event.id);
        option.dataset.resultFormat = event.result_format;
        eventSelect.add(option);
    });

    eventSelect.addEventListener('change', async (e) => {
        const eventId = e.target.value;
        if (!eventId) {
            resultsContainer.innerHTML = '';
            return;
        }
        const selectedOption = e.target.options[e.target.selectedIndex];
        const resultFormat = selectedOption.dataset.resultFormat;
        await loadAndRenderResults(eventId, resultFormat, code, containerElementId, selectElementId);
    });
}

async function loadAndRenderResults(eventId, resultFormat, code, containerElementId, selectElementId) {
    const resultsContainer = document.getElementById(containerElementId);
    resultsContainer.innerHTML = '<p>Loading results...</p>';
    try {
        const response = await fetchEventResults(eventId, code);
        // The API now returns an object { participants: [], result_format: '...' }
        renderResultsTable(
            response.participants,
            eventId,
            response.result_format,
            code,
            containerElementId,
            selectElementId,
            response.max_per_house, // New: Max participants per house for this event
            response.house_participation_counts // New: Current house counts for this event
        );
    } catch (error) {
        showError(`Failed to load results: ${error.message}`);
        resultsContainer.innerHTML = `<p class="text-red-500">Error loading results.</p>`;
    }
}

function renderResultsTable(data, eventId, resultFormat, code, containerElementId, selectElementId, maxPerHouse, houseParticipationCounts) {
    const container = document.getElementById(containerElementId);
    container.innerHTML = '';

    // Add "Start Race" button if applicable
    const isRace = ['time', 'duration'].includes(resultFormat);

    if (isRace) {
        const startButton = document.createElement('button');
        startButton.className = 'mb-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700';
        startButton.textContent = 'START RACE';
        startButton.addEventListener('click', async () => {
            try {
                await startRace(eventId, code);
                showToast('Race started!', { type: 'success' });
                await loadAndRenderResults(eventId, resultFormat, code, containerElementId, selectElementId); // Refresh
            } catch (error) {
                showError(`Failed to start race: ${error.message}`);
            }
        });
        container.appendChild(startButton);
    }

    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-gray-200';
    table.innerHTML = `
        <thead class="bg-gray-50">
            <tr>
                <th class="p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th class="p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                <th class="p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">House</th>
                ${isRace ? '<th class="p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Time</th>' : ''}
                ${isRace ? '<th class="p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Finish Time</th>' : ''}
                <th class="p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Result</th>
                <th class="p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                ${isRace ? '<th class="p-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>' : ''}
            </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200"></tbody>
    `;
    container.appendChild(table);
    const tbody = table.querySelector('tbody');

    // Calculate ranks
    const finishedParticipants = data
        .filter(d => d.result?.result_value != null)
        .sort((a, b) => {
            // For races, lower is better. For field events, higher is better.
            return isRace 
                ? a.result.result_value - b.result.result_value 
                : b.result.result_value - a.result.result_value;
        });
    
    const ranks = new Map();
    if (finishedParticipants.length > 0) {
        // Assign initial rank
        ranks.set(finishedParticipants[0].student.id, { rank: 1, isTie: false });

        for (let i = 1; i < finishedParticipants.length; i++) {
            const current = finishedParticipants[i];
            const previous = finishedParticipants[i - 1];

            if (current.result.result_value === previous.result.result_value) {
                // It's a tie, assign the same rank as the previous participant
                ranks.set(current.student.id, { rank: ranks.get(previous.student.id).rank, isTie: true });
                ranks.get(previous.student.id).isTie = true; // Mark the previous one as a tie as well
            } else {
                // Not a tie, rank is the current position (i + 1)
                ranks.set(current.student.id, { rank: i + 1, isTie: false });
            }
        }
    }

    // --- Identify students over the house quota ---
    const overQuotaStudentIds = new Set();
    if (maxPerHouse > 0) {
        const participantsByHouse = data.reduce((acc, item) => {
            const house = item.student.house;
            if (!acc[house]) acc[house] = [];
            acc[house].push(item.student);
            return acc;
        }, {});

        for (const house in participantsByHouse) {
            if (participantsByHouse[house].length > maxPerHouse) {
                // Sort students within the house alphabetically to get a consistent order
                const sortedStudents = participantsByHouse[house].sort((a, b) => a.name.localeCompare(b.name));
                // The students who are over the quota are the ones after the maxPerHouse limit
                const studentsOverQuota = sortedStudents.slice(maxPerHouse);
                studentsOverQuota.forEach(student => overQuotaStudentIds.add(student.id));
            }
        }
    }

    data.sort((a, b) => {
        const aIsOverQuota = overQuotaStudentIds.has(a.student.id);
        const bIsOverQuota = overQuotaStudentIds.has(b.student.id);

        if (aIsOverQuota && !bIsOverQuota) {
            return 1; // Valid students (b) come before over-quota students (a)
        }
        if (!aIsOverQuota && bIsOverQuota) {
            return -1; // Valid students (a) come before over-quota students (b)
        }
        // If both have the same quota status, sort by name
        return a.student.name.localeCompare(b.student.name);
    }).forEach(item => {
        const { student, result } = item;
        const tr = document.createElement('tr');
        
        const isOverQuota = overQuotaStudentIds.has(student.id);
        if (isOverQuota) tr.classList.add('opacity-50', 'pointer-events-none', 'bg-red-50'); // Grey out, disable clicks, and add red background


        const formatResult = (totalSeconds) => {
            if (totalSeconds == null) return '—';

            const minutes = Math.floor(totalSeconds / 60);
            const remainingSeconds = totalSeconds % 60;
            const seconds = Math.floor(remainingSeconds);
            const milliseconds = Math.round((remainingSeconds - seconds) * 1000);

            const paddedMinutes = String(minutes).padStart(2, '0');
            const paddedSeconds = String(seconds).padStart(2, '0');
            const paddedMilliseconds = String(milliseconds).padStart(3, '0');

            return `${paddedMinutes}:${paddedSeconds}:${paddedMilliseconds}`;
        };

        const nameCell = document.createElement('td');
        nameCell.className = 'p-2 whitespace-nowrap';
        nameCell.textContent = student.name;

        const yearCell = document.createElement('td');
        yearCell.className = 'p-2 whitespace-nowrap';
        yearCell.textContent = student.year;

        const houseCell = document.createElement('td');
        houseCell.className = 'p-2 whitespace-nowrap';
        houseCell.textContent = student.house;

        const rankCell = document.createElement('td');
        rankCell.className = 'p-2 whitespace-nowrap';
        const rankInfo = ranks.get(student.id);
        if (rankInfo) {
            rankCell.textContent = rankInfo.isTie ? `=${rankInfo.rank}` : rankInfo.rank;
        } else {
            rankCell.textContent = '—';
        }

        const actionsCell = document.createElement('td');
        actionsCell.className = 'p-2 whitespace-nowrap';

        tr.appendChild(nameCell);
        tr.appendChild(yearCell);
        tr.appendChild(houseCell);

        if (isRace) {
            const startTimeCell = createEditableCell(result?.start_time, student.id, 'start_time', eventId, resultFormat, code, containerElementId, selectElementId, isOverQuota);
            const finishTimeCell = createEditableCell(result?.finish_time, student.id, 'finish_time', eventId, resultFormat, code, containerElementId, selectElementId, isOverQuota);
            const resultCell = document.createElement('td');
            resultCell.className = 'p-2 whitespace-nowrap font-semibold';
            resultCell.textContent = formatResult(result?.result_value);

            tr.appendChild(startTimeCell);
            tr.appendChild(finishTimeCell);
            tr.appendChild(resultCell);
        } else {
            // For Field events, the result cell is directly editable
            const resultCell = createEditableResultCell(result?.result_value, student.id, eventId, resultFormat, code, containerElementId, selectElementId, isOverQuota);
            tr.appendChild(resultCell);
        }

        tr.appendChild(rankCell);

        if (isRace) {
            tr.appendChild(actionsCell);
            const finishButton = document.createElement('button');
            finishButton.className = 'px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700';
            finishButton.textContent = 'FINISH';
            if (result?.start_time && !result.finish_time && !isOverQuota) { // Disable if over quota
                finishButton.addEventListener('click', async () => {
                    await finishRace(eventId, student.id, code);
                    showToast('Finish time recorded!', { type: 'success' });
                    await loadAndRenderResults(eventId, resultFormat, code, containerElementId, selectElementId);
                });
                actionsCell.appendChild(finishButton);
            }
        }

        tbody.appendChild(tr);
    });
}

function createEditableCell(isoString, studentId, field, eventId, resultFormat, code, containerElementId, selectElementId, isOverQuota = false) {
    const td = document.createElement('td');
    td.className = 'p-2 whitespace-nowrap';
    
    if (isoString) {
        td.textContent = new Date(isoString).toLocaleTimeString('en-GB', {
            timeZone: 'Asia/Hong_Kong',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
    } else {
        td.textContent = '—';
    }

    if (!isOverQuota) { // Only add dblclick listener if not over quota
        const originalValue = td.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalValue;
        input.className = 'w-full p-1 border rounded';
        td.innerHTML = '';
        td.appendChild(input);
        input.focus();

        const save = async () => {
            const newTimeValue = input.value.trim();

            if (newTimeValue === originalValue) {
                input.removeEventListener('blur', save);
                td.textContent = originalValue;
                return;
            }

            let confirmed = false;
            let payloadValue = null;

            if (!newTimeValue && originalValue !== '—') {
                confirmed = await showConfirm({
                    title: 'Confirm Deletion',
                    bodyHtml: `<p>Are you sure you want to delete the previous result: <strong>${originalValue}</strong>?</p>`,
                    confirmText: 'Delete'
                });
                if (confirmed) payloadValue = null;
            } else {
                confirmed = await showConfirm({
                    title: 'Confirm Change',
                    bodyHtml: `<p>Are you sure you want to change <strong>${originalValue}</strong> to <strong>${newTimeValue}</strong>?</p>`,
                    confirmText: 'Confirm'
                });
                if (confirmed) {
                    const originalDatePart = new Date(isoString).toISOString().split('T')[0];
                    const newHktDateTimeString = `${originalDatePart}T${newTimeValue}+08:00`;
                    payloadValue = new Date(newHktDateTimeString).toISOString();
                }
            }

            if (!confirmed) {
                input.removeEventListener('blur', save);
                td.textContent = originalValue;
                return;
            }

            try {
                await updateResult(eventId, studentId, { [field]: payloadValue });
                showToast('Result updated!', { type: 'success' });
                await loadAndRenderResults(eventId, resultFormat, code, containerElementId, selectElementId);
            } catch (error) {
                showError(`Failed to update time: ${error.message}`);
                td.textContent = originalValue;
            }
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                input.removeEventListener('blur', save);
                td.textContent = originalValue;
            }
        });
    }
    return td;
}

function createEditableResultCell(currentValue, studentId, eventId, resultFormat, code, containerElementId, selectElementId, isOverQuota = false) {
    const td = document.createElement('td');
    td.className = 'p-2 whitespace-nowrap';

    const input = document.createElement('input');
    input.type = 'text'; // Use text to allow for decimal points
    input.className = 'w-full p-1 border rounded';
    input.value = currentValue ?? '';
    input.placeholder = 'Enter result...';

    if (isOverQuota) {
        input.disabled = true;
        td.classList.add('text-gray-400'); // Grey out text
    } else {
        const save = async () => {
            let newValue = input.value.trim();

            if (newValue === String(currentValue ?? '')) {
                return; // No change
            }

            let payloadValue = null;
            if (newValue !== '') {
                payloadValue = parseFloat(newValue);
                // Validation
                if (isNaN(payloadValue)) {
                    showError('Result must be a valid number.');
                    input.value = currentValue ?? ''; // Revert
                    return;
                }
                if (resultFormat === 'points' && !Number.isInteger(payloadValue)) {
                    showError('Points must be a whole number.');
                    input.value = currentValue ?? ''; // Revert
                    return;
                }
            }

            try {
                await updateResult(eventId, studentId, { result_value: payloadValue });
                showToast('Result saved!', { type: 'success' });
                await loadAndRenderResults(eventId, resultFormat, code, containerElementId, selectElementId);
            } catch (error) {
                showError(`Failed to save result: ${error.message}`);
                input.value = currentValue ?? ''; // Revert
            }
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                input.value = currentValue ?? '';
                input.blur(); // Trigger blur to exit edit mode without saving
            }
        });
    }

    td.appendChild(input);
    return td;
}