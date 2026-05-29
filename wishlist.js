const database = firebase.database();
const wishesRef = database.ref('/wishes');

// --- DOM Elements ---
const wishlistContainer = document.getElementById('wishlist');
const adminPanel = document.getElementById('admin-panel');
const openAdminBtn = document.getElementById('open-admin-btn');
const closeAdminBtn = document.getElementById('close-admin-btn');
const addWishForm = document.getElementById('add-wish-form');
const submitWishBtn = document.getElementById('submit-wish-btn');
const editModal = document.getElementById('edit-modal');
const closeEditModalBtn = document.getElementById('close-edit-modal-btn');
const editWishForm = document.getElementById('edit-wish-form');

// --- Data Loading ---
wishesRef.on('value', (snapshot) => {
    const data = snapshot.val();
    wishlistContainer.innerHTML = '';
    if (data) {
        const wishes = Object.entries(data)
            .map(([key, value]) => ({ key, ...value }))
            .sort((a, b) => b.timestamp - a.timestamp);
        wishes.forEach((wish, index) => {
            const card = createWishCard(wish, index);
            wishlistContainer.appendChild(card);
        });
    } else {
        wishlistContainer.innerHTML = `<div class="col-span-full text-center text-gray-500"><p class="text-xl">Пока нет ни одного желания.</p><p class="mt-2">Нажмите на '+' чтобы добавить первое.</p></div>`;
    }
});

function createWishCard(wish, index) {
    const card = document.createElement('div');
    card.className = `card p-6 flex flex-col fade-in-up ${wish.completed ? 'completed' : ''}`;
    card.style.animationDelay = `${index * 50}ms`;
    
    let link = '';
    if (wish.link) {
        link = `<a href="${wish.link}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:text-blue-400 mt-4 inline-block">Посмотреть</a>`;
    }

    card.innerHTML = `
        <div class="flex-grow">
            <h3 class="text-xl font-bold">${wish.name}</h3>
            <p class="text-gray-400 mt-2">${wish.description}</p>
            ${link}
        </div>
        <div class="flex justify-between items-center mt-4">
            <div class="flex items-center">
                <input type="checkbox" id="wish-${wish.key}" class="wish-checkbox" ${wish.completed ? 'checked' : ''}>
                <label for="wish-${wish.key}" class="ml-2 text-sm text-gray-400">Выполнено</label>
            </div>
            <div class="flex">
                <button class="edit-wish-btn text-gray-400 hover:text-white mr-4" data-id="${wish.key}">✏️</button>
                <button class="delete-wish-btn text-gray-400 hover:text-white" data-id="${wish.key}">🗑️</button>
            </div>
        </div>
    `;

    // Event Listeners
    card.querySelector('.edit-wish-btn').addEventListener('click', () => openEditModal(wish));
    card.querySelector('.delete-wish-btn').addEventListener('click', () => deleteWish(wish.key));
    card.querySelector('.wish-checkbox').addEventListener('change', (e) => {
        toggleWishCompleted(wish.key, e.target.checked);
    });

    return card;
}

async function toggleWishCompleted(key, isCompleted) {
    try {
        await wishesRef.child(key).update({ completed: isCompleted });
    } catch (error) {
        console.error("Error updating wish status:", error);
        alert("Не удалось обновить статус желания. Попробуйте снова.");
    }
}

// --- Admin Panel Logic ---
function showAdminPanel() { adminPanel.classList.remove('hidden'); }
function hideAdminPanel() { adminPanel.classList.add('hidden'); }
openAdminBtn.addEventListener('click', showAdminPanel);
closeAdminBtn.addEventListener('click', hideAdminPanel);

addWishForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = e.target.name.value;
    const description = e.target.description.value;
    const link = e.target.link.value;

    try {
        const newWishRef = wishesRef.push();
        await newWishRef.set({
            name,
            description,
            link,
            completed: false,
            timestamp: Date.now()
        });
        addWishForm.reset();
        hideAdminPanel();
    } catch (error) {
        console.error("Error adding wish:", error);
        alert("Не удалось добавить желание. Попробуйте снова.");
    }
});

// --- Edit Modal Logic ---
function openEditModal(wish) {
    document.getElementById('edit-wish-id').value = wish.key;
    document.getElementById('edit-wish-name').value = wish.name;
    document.getElementById('edit-wish-description').value = wish.description;
    document.getElementById('edit-wish-link').value = wish.link;
    editModal.classList.remove('hidden');
}

function closeEditModal() {
    editModal.classList.add('hidden');
}
closeEditModalBtn.addEventListener('click', closeEditModal);

editWishForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = e.target.id.value;
    const name = e.target.name.value;
    const description = e.target.description.value;
    const link = e.target.link.value;

    try {
        await wishesRef.child(id).update({
            name,
            description,
            link
        });
        closeEditModal();
    } catch (error) {
        console.error("Error updating wish:", error);
        alert("Не удалось обновить желание. Попробуйте снова.");
    }
});

// --- Delete Logic ---
async function deleteWish(key) {
    const isConfirmed = confirm("Ты уверен, что хочешь удалить это желание?");
    if (isConfirmed) {
        try {
            await wishesRef.child(key).remove();
        } catch (error) {
            console.error("Error deleting wish:", error);
            alert("Не удалось удалить желание. Попробуйте снова.");
        }
    }
}
