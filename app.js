// --- App State ---
let currentPhotos = [];
let currentIndex = 0;
let currentKey = '';
let touchStartX = 0;
let currentTranslate = 0;
let isDragging = false;

const database = firebase.database();
const photosRef = database.ref('/photos');

// --- DOM Elements ---
const gallery = document.getElementById('gallery');
const lightbox = document.getElementById('lightbox');
const filmstrip = document.getElementById('lightbox-filmstrip');
const prevImg = document.getElementById('prev-img');
const currentImg = document.getElementById('current-img');
const nextImg = document.getElementById('next-img');
const lightboxDate = document.getElementById('lightbox-date');
const lightboxLocation = document.getElementById('lightbox-location');
const lightboxComment = document.getElementById('lightbox-comment');
const deletePhotoBtn = document.getElementById('delete-photo-btn');
const lightboxClose = document.getElementById('lightbox-close');
const adminPanel = document.getElementById('admin-panel');
const openAdminBtn = document.getElementById('open-admin-btn');
const closeAdminBtn = document.getElementById('close-admin-btn');
const uploadForm = document.getElementById('upload-form');
const submitBtn = document.getElementById('submit-btn');
const btnText = submitBtn.querySelector('.btn-text');
const spinner = submitBtn.querySelector('.spinner');

// Comment editing elements
const editCommentContainer = document.getElementById('edit-comment-container');
const editCommentTextarea = document.getElementById('edit-comment-textarea');
const saveCommentBtn = document.getElementById('save-comment-btn');
const cancelCommentBtn = document.getElementById('cancel-comment-btn');


// --- Data Loading ---
// Helper function to parse 'dd.mm.yyyy' date strings
function parseDate(dateString) {
    if (!dateString) return null;
    const parts = dateString.split('.');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // month is 0-indexed in JS Date
        const year = parseInt(parts[2], 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            // Create a date in UTC to avoid timezone issues
            return new Date(Date.UTC(year, month, day));
        }
    }
    // Fallback for other formats that JS `new Date()` can handle
    const d = new Date(dateString);
    return isNaN(d) ? null : d;
}

photosRef.on('value', (snapshot) => {
    const data = snapshot.val();
    gallery.innerHTML = '';
    if (data) {
        currentPhotos = Object.entries(data)
            .map(([key, value]) => ({ 
                key, 
                ...value, 
                // Create a parsable Date object from the user-entered date string
                parsedDate: parseDate(value.date) 
            }))
            // Sort by the parsed date, newest first. Fallback to timestamp if date is invalid.
            .sort((a, b) => (b.parsedDate || b.timestamp) - (a.parsedDate || a.timestamp));

        const photosByMonth = currentPhotos.reduce((acc, photo) => {
            // Use parsedDate for grouping, but fallback to timestamp if it's invalid
            const date = photo.parsedDate ? photo.parsedDate : new Date(photo.timestamp);
            
            // Gracefully handle invalid dates that might still exist in the database
            if (isNaN(date.getTime())) {
                return acc;
            }

            const year = date.getUTCFullYear();
            const month = date.toLocaleString('ru-RU', { month: 'long', timeZone: 'UTC' });
            const groupTitle = `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;

            if (!acc[groupTitle]) {
                acc[groupTitle] = [];
            }
            acc[groupTitle].push(photo);
            return acc;
        }, {});

        let photoIndex = 0;
        // Get group titles and sort them chronologically (newest first)
        const sortedGroupTitles = Object.keys(photosByMonth).sort((a, b) => {
            const dateA = photosByMonth[a][0].parsedDate || new Date(photosByMonth[a][0].timestamp);
            const dateB = photosByMonth[b][0].parsedDate || new Date(photosByMonth[b][0].timestamp);
            return dateB - dateA;
        });

        sortedGroupTitles.forEach(groupTitle => {
            const monthContainer = document.createElement('div');
            monthContainer.className = 'month-group col-span-full';
            
            const titleEl = document.createElement('h2');
            titleEl.className = 'month-title text-xl font-bold text-gray-800 mb-4 mt-8';
            titleEl.textContent = groupTitle;
            monthContainer.appendChild(titleEl);

            const photosGrid = document.createElement('div');
            photosGrid.className = 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-2 md:gap-4';
            
            // Sort photos within the group by date
            const sortedPhotos = photosByMonth[groupTitle].sort((a, b) => (b.parsedDate || b.timestamp) - (a.parsedDate || a.timestamp));

            sortedPhotos.forEach(photo => {
                const card = createPhotoCard(photo, photoIndex);
                photosGrid.appendChild(card);
                photoIndex++;
            });

            monthContainer.appendChild(photosGrid);
            gallery.appendChild(monthContainer);
        });

    } else {
        currentPhotos = [];
        gallery.innerHTML = `<div class="col-span-full text-center text-gray-500"><p class="text-xl">Пока нет ни одного воспоминания.</p><p class="mt-2">Нажмите на '+' чтобы добавить первое.</p></div>`;
    }
});

function createPhotoCard(photo, index) {
    const card = document.createElement('div');
    card.className = 'card photo-card cursor-pointer fade-in-up';
    card.style.animationDelay = `${index * 50}ms`;
    
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = photo.comment || 'Воспоминание';
    img.className = 'w-full h-full object-cover';
    card.appendChild(img);
    card.addEventListener('click', () => openLightbox(index));
    return card;
}

// --- Comment Logic ---
function showCommentEdit(show) {
    editCommentContainer.classList.toggle('hidden', !show);
    lightboxComment.classList.toggle('hidden', show);
}

function openCommentEditor() {
    const currentComment = lightboxComment.textContent;
    editCommentTextarea.value = (currentComment === 'Добавить комментарий...') ? '' : currentComment;
    showCommentEdit(true);
    editCommentTextarea.focus();
}

async function saveComment() {
    const newComment = editCommentTextarea.value.trim();
    if (!currentKey) return;

    try {
        await photosRef.child(currentKey).update({ comment: newComment });
        lightboxComment.textContent = newComment || 'Добавить комментарий...';
        showCommentEdit(false);
    } catch (error) {
        console.error("Ошибка при сохранении комментария:", error);
        alert("Не удалось сохранить комментарий. Попробуйте еще раз.");
    }
}

function cancelCommentEdit() {
    showCommentEdit(false);
}

// --- Lightbox & Navigation Logic ---
function setupFilmstrip(index) {
    // Reset comment editor state
    showCommentEdit(false);

    // Current image
    const currentPhoto = currentPhotos[index];
    currentKey = currentPhoto?.key; 
    currentImg.src = currentPhoto?.url || '';
    currentImg.alt = currentPhoto?.comment || '';
    lightboxDate.textContent = currentPhoto.date;
    lightboxLocation.textContent = currentPhoto.location;
    lightboxComment.textContent = currentPhoto.comment || 'Добавить комментарий...';

    // Previous image
    if (index > 0) {
        prevImg.src = currentPhotos[index - 1].url;
        prevImg.alt = currentPhotos[index - 1].comment || '';
    } else {
        prevImg.removeAttribute('src');
    }

    // Next image
    if (index < currentPhotos.length - 1) {
        nextImg.src = currentPhotos[index + 1].url;
        nextImg.alt = currentPhotos[index + 1].comment || '';
    } else {
        nextImg.removeAttribute('src');
    }
}

function setTranslate(xPos, transition = '') {
    filmstrip.style.transition = transition;
    filmstrip.style.transform = `translateX(${xPos}px)`;
}

function openLightbox(index) {
    currentIndex = index;
    lightbox.classList.remove('hidden');
    document.body.classList.add('lightbox-open');
    setupFilmstrip(currentIndex);
    
    // Initial position without transition
    const offset = -lightbox.offsetWidth;
    setTranslate(offset, 'none');

    // Add event listeners
    document.addEventListener('keydown', handleKeydown);
    lightbox.addEventListener('touchstart', handleTouchStart);
    lightbox.addEventListener('touchmove', handleTouchMove);
    lightbox.addEventListener('touchend', handleTouchEnd);
    deletePhotoBtn.addEventListener('click', handleDeletePhoto);
    lightboxComment.addEventListener('click', openCommentEditor);
    saveCommentBtn.addEventListener('click', saveComment);
    cancelCommentBtn.addEventListener('click', cancelCommentEdit);
}

function closeLightbox() {
    lightbox.classList.add('hidden');
    document.body.classList.remove('lightbox-open');
    
    // Remove event listeners
    document.removeEventListener('keydown', handleKeydown);
    lightbox.removeEventListener('touchstart', handleTouchStart);
    lightbox.removeEventListener('touchmove', handleTouchMove);
    lightbox.removeEventListener('touchend', handleTouchEnd);
    deletePhotoBtn.removeEventListener('click', handleDeletePhoto);
    lightboxComment.removeEventListener('click', openCommentEditor);
    saveCommentBtn.removeEventListener('click', saveComment);
    cancelCommentBtn.removeEventListener('click', cancelCommentEdit);
}

function showNext() {
    if (currentIndex < currentPhotos.length - 1) {
        currentIndex++;
        const offset = -lightbox.offsetWidth * 2;
        setTranslate(offset, 'transform 0.3s ease-out');
        filmstrip.addEventListener('transitionend', resetToCenter, { once: true });
    } else {
        snapToCenter();
    }
}

function showPrevious() {
    if (currentIndex > 0) {
        currentIndex--;
        setTranslate(0, 'transform 0.3s ease-out');
        filmstrip.addEventListener('transitionend', resetToCenter, { once: true });
    } else {
        snapToCenter();
    }
}

function snapToCenter() {
     const offset = -lightbox.offsetWidth;
     setTranslate(offset, 'transform 0.3s ease-out');
}

function resetToCenter() {
    setupFilmstrip(currentIndex);
    const offset = -lightbox.offsetWidth;
    setTranslate(offset, 'none');
}

// --- Navigation Handlers ---
function handleKeydown(e) {
    if (e.key === 'ArrowRight') showNext();
    else if (e.key === 'ArrowLeft') showPrevious();
    else if (e.key === 'Escape') closeLightbox();
}

function handleTouchStart(e) {
    isDragging = true;
    touchStartX = e.touches[0].clientX;
    filmstrip.style.transition = 'none';
}

function handleTouchMove(e) {
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const deltaX = currentX - touchStartX;
    currentTranslate = -lightbox.offsetWidth + deltaX;
    setTranslate(currentTranslate, 'none');
}

function handleTouchEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const swipeThreshold = lightbox.offsetWidth / 4;

    if (deltaX < -swipeThreshold) {
        showNext();
    } else if (deltaX > swipeThreshold) {
        showPrevious();
    } else {
        snapToCenter();
    }
}

lightboxClose.addEventListener('click', closeLightbox);

async function handleDeletePhoto() {
    if (!currentKey) return;

    const isConfirmed = confirm("Ты уверен, что хочешь удалить это воспоминание навсегда?");
    if (isConfirmed) {
        try {
            await photosRef.child(currentKey).remove();
            closeLightbox();
        } catch (error) {
            console.error("Ошибка при удалении фото:", error);
            alert("Не удалось удалить фото. Попробуй еще раз.");
        }
    }
}

// --- Admin Panel & Form Logic ---
function showAdminPanel() { adminPanel.classList.remove('hidden'); }
function hideAdminPanel() { adminPanel.classList.add('hidden'); }
openAdminBtn.addEventListener('click', showAdminPanel);
closeAdminBtn.addEventListener('click', hideAdminPanel);
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const apiKey = sessionStorage.getItem('imgbb_key');
    if (!apiKey) {
        alert("Ошибка: Ключ API для загрузки изображений не найден. Попробуйте обновить страницу или войти заново.");
        return;
    }
    const imgbbUploadUrl = `https://api.imgbb.com/1/upload?key=${apiKey}`;

    toggleSpinner(true);
    const imageFile = e.target.image.files[0];
    const date = e.target.date.value;
    const location = e.target.location.value;
    const comment = e.target.comment.value;
    try {
        const formData = new FormData();
        formData.append('image', imageFile);
        const response = await fetch(imgbbUploadUrl, { method: 'POST', body: formData });
        const result = await response.json();
        if (result.success) {
            const imageUrl = result.data.url;
            const newPhotoRef = photosRef.push();
            await newPhotoRef.set({ url: imageUrl, date: date, location: location, comment: comment, timestamp: Date.now() });
            uploadForm.reset();
            hideAdminPanel();
        } else {
            throw new Error(`Image upload failed: ${result.error.message}`);
        }
    } catch (error) {
        console.error("Error uploading memory:", error);
        alert("Не удалось загрузить воспоминание. Пожалуйста, попробуйте снова.");
    } finally {
        toggleSpinner(false);
    }
});
function toggleSpinner(show) {
    spinner.classList.toggle('hidden', !show);
    btnText.classList.toggle('hidden', show);
    submitBtn.disabled = show;
}
