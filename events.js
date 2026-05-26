// --- Initialize Firebase ---
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const eventsRef = database.ref('/events');

// --- DOM Elements ---
const timelineContainer = document.getElementById('timeline-container');
const eventsListContainer = document.getElementById('events-list-container');
const adminPanel = document.getElementById('admin-panel');
const openAdminBtn = document.getElementById('open-admin-btn');
const closeAdminBtn = document.getElementById('close-admin-btn');
const eventForm = document.getElementById('event-form');
const eventIdInput = document.getElementById('event-id');
const eventNameInput = document.getElementById('event-name');
const eventDateInput = document.getElementById('event-date');
const eventRepeatInput = document.getElementById('event-repeat');

// --- State ---
let allEvents = [];

// --- Date Calculation ---
function getNextOccurrence(dateString, repeatType) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const originalEventDate = new Date(dateString);
    originalEventDate.setHours(0, 0, 0, 0);

    if (repeatType === 'none') {
        return originalEventDate >= today ? originalEventDate : null;
    }

    let nextEventDate = new Date(originalEventDate);

    if (repeatType === 'yearly') {
        nextEventDate.setFullYear(today.getFullYear());
        if (nextEventDate < today) {
            nextEventDate.setFullYear(today.getFullYear() + 1);
        }
    } else if (repeatType === 'monthly') {
        nextEventDate.setFullYear(today.getFullYear());
        nextEventDate.setMonth(today.getMonth());
        if (nextEventDate < today) {
            nextEventDate.setMonth(today.getMonth() + 1);
        }
        // Handle cases like event on 31st, but next month has 30 days
        while (nextEventDate.getDate() !== originalEventDate.getDate()) {
            nextEventDate.setDate(0); // Go to last day of previous month
            nextEventDate.setMonth(nextEventDate.getMonth() + 2); // Go to correct month
            nextEventDate.setDate(originalEventDate.getDate());
        }
    } else if (repeatType === 'weekly') {
        const eventDayOfWeek = originalEventDate.getDay();
        const todayDayOfWeek = today.getDay();
        const daysToAdd = (eventDayOfWeek - todayDayOfWeek + 7) % 7;
        nextEventDate = new Date(today);
        nextEventDate.setDate(today.getDate() + daysToAdd);
    }
    
    return nextEventDate;
}


function daysUntil(date) {
    if (!date) return Infinity;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = date.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// --- Rendering ---
function renderEvents(events) {
    const processedEvents = events.map(event => {
        const nextOccurrence = getNextOccurrence(event.date, event.repeat);
        return {
            ...event,
            nextOccurrence,
            daysUntil: daysUntil(nextOccurrence)
        };
    });

    timelineContainer.innerHTML = '';
    const upcomingEvents = processedEvents
        .filter(e => e.nextOccurrence)
        .sort((a, b) => a.daysUntil - b.daysUntil)
        .slice(0, 4);

    if (upcomingEvents.length > 0) {
        upcomingEvents.forEach((event, index) => {
            const timelineCard = createTimelineCard(event, index);
            timelineContainer.appendChild(timelineCard);
        });
    } else {
        timelineContainer.innerHTML = `<p class="col-span-full text-center text-gray-500">Нет ближайших событий.</p>`;
    }

    eventsListContainer.innerHTML = '';
    const sortedAllEvents = processedEvents.sort((a, b) => a.daysUntil - b.daysUntil);
    if (sortedAllEvents.length > 0) {
        sortedAllEvents.forEach((event, index) => {
            const eventRow = createEventRow(event, index);
            eventsListContainer.appendChild(eventRow);
        });
    } else {
        eventsListContainer.innerHTML = `<p class="text-center text-gray-500">Пока нет ни одного события. Нажмите '+' чтобы добавить.</p>`;
    }
}

function createTimelineCard(event, index) {
    const card = document.createElement('div');
    card.className = 'card p-4 text-center fade-in-up';
    card.style.animationDelay = `${index * 50}ms`;
    
    let daysText = event.daysUntil === 0 ? 'Сегодня!' : (event.daysUntil === 1 ? 'Завтра' : `через ${event.daysUntil} дней`);

    card.innerHTML = `
        <div class="text-3xl font-bold">${event.daysUntil === 0 ? '🎉' : event.daysUntil}</div>
        <div class="text-sm text-gray-400">${event.daysUntil === 0 ? '' : 'дней'}</div>
        <p class="mt-2 font-semibold truncate">${event.name}</p>
    `;
    return card;
}

function createEventRow(event, index) {
    const row = document.createElement('div');
    row.className = 'card p-4 flex items-center justify-between fade-in-up';
    row.style.animationDelay = `${index * 50}ms`;
    
    const originalDate = new Date(event.date);
    const formattedDate = originalDate.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
    
    const repeatSymbols = {
        weekly: '&#x1F501; (нед)',
        monthly: '&#x1F501; (мес)',
        yearly: '&#x1F501; (год)'
    };
    const repeatIcon = repeatSymbols[event.repeat] || '';

    let daysText = '';
    if (event.daysUntil === Infinity) {
        daysText = 'прошло';
    } else if (event.daysUntil === 0) {
        daysText = 'сегодня';
    } else {
        daysText = `через ${event.daysUntil} д.`;
    }

    row.innerHTML = `
        <div>
            <h3 class="font-bold text-lg">${event.name} <span class="text-blue-400 text-sm">${repeatIcon}</span></h3>
            <p class="text-gray-400 text-sm">${formattedDate} (${daysText})</p>
        </div>
        <div>
            <button class="edit-event-btn text-gray-400 hover:text-white mr-4" data-id="${event.key}">✏️</button>
            <button class="delete-event-btn text-gray-400 hover:text-white" data-id="${event.key}">🗑️</button>
        </div>
    `;

    row.querySelector('.edit-event-btn').addEventListener('click', () => openEditForm(event));
    row.querySelector('.delete-event-btn').addEventListener('click', () => deleteEvent(event.key));

    return row;
}

// --- CRUD ---
async function handleFormSubmit(e) {
    e.preventDefault();
    const id = eventIdInput.value;
    const name = eventNameInput.value;
    const date = eventDateInput.value;
    const repeat = eventRepeatInput.value; // Now a string 'none', 'weekly', etc.

    const eventData = { name, date, repeat, timestamp: Date.now() };

    try {
        if (id) {
            await eventsRef.child(id).update(eventData);
        } else {
            await eventsRef.push(eventData);
        }
        closeAdminPanel();
    } catch (error) {
        console.error("Ошибка при сохранении события:", error);
        alert("Не удалось сохранить событие.");
    }
}

function openEditForm(event) {
    eventIdInput.value = event.key;
    eventNameInput.value = event.name;
    eventDateInput.value = event.date;
    eventRepeatInput.value = event.repeat || 'none'; // Handle old data that might not have this field
    adminPanel.classList.remove('hidden');
}

async function deleteEvent(key) {
    if (confirm('Вы уверены, что хотите удалить это событие?')) {
        try {
            await eventsRef.child(key).remove();
        } catch (error) {
            console.error("Ошибка при удалении события:", error);
            alert("Не удалось удалить событие.");
        }
    }
}

// --- Admin Panel ---
function openAdminPanel() {
    eventIdInput.value = '';
    eventForm.reset();
    adminPanel.classList.remove('hidden');
}

function closeAdminPanel() {
    adminPanel.classList.add('hidden');
}

// --- Event Listeners ---
openAdminBtn.addEventListener('click', openAdminPanel);
closeAdminBtn.addEventListener('click', closeAdminPanel);
eventForm.addEventListener('submit', handleFormSubmit);

// --- Initial Load ---
eventsRef.on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        allEvents = Object.entries(data).map(([key, value]) => ({ key, ...value }));
        renderEvents(allEvents);
    } else {
        allEvents = [];
        renderEvents([]);
    }
});
