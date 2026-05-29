document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const currentPage = window.location.pathname.split('/').pop();

    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in.
            console.log("User is signed in:", user.uid);
            if (currentPage === 'login.html') {
                // If on login page, redirect to the main page.
                console.log("Redirecting to index.html from login.html");
                window.location.href = 'index.html';
            }
        } else {
            // User is signed out.
            console.log("User is signed out.");
            if (currentPage !== 'login.html') {
                // If not on login page, redirect to the login page.
                console.log("Redirecting to login.html");
                window.location.href = 'login.html';
            }
        }
    });
});
