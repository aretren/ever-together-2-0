document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.database();
    const currentPage = window.location.pathname.split('/').pop();

    const fetchAndCacheApiKey = () => {
        return new Promise((resolve, reject) => {
            const cachedKey = sessionStorage.getItem('imgbb_key');
            if (cachedKey) {
                console.log("IMGBB key found in cache.");
                return resolve(cachedKey);
            }

            console.log("Fetching IMGBB key from Firebase...");
            db.ref('api-imgbb').once('value')
                .then(snapshot => {
                    const apiKey = snapshot.val();
                    if (apiKey) {
                        console.log("IMGBB key fetched and cached.");
                        sessionStorage.setItem('imgbb_key', apiKey);
                        resolve(apiKey);
                    } else {
                        console.error("IMGBB API Key not found in the database.");
                        reject("API key not found.");
                    }
                })
                .catch(error => {
                    console.error("Error fetching IMGBB API Key:", error);
                    reject(error);
                });
        });
    };

    const clearApiKey = () => {
        console.log("Clearing IMGBB key from cache.");
        sessionStorage.removeItem('imgbb_key');
    };

    auth.onAuthStateChanged(user => {
        if (user) {
            // User is signed in.
            console.log("User is signed in:", user.uid);
            
            // Fetch and cache the API key as soon as the user is authenticated.
            fetchAndCacheApiKey().catch(err => {
                console.error("Could not obtain IMGBB API key after login.", err);
                // Optionally, alert the user or disable upload functionality.
            });

            if (currentPage === 'login.html') {
                // If on login page, redirect to the main page.
                console.log("Redirecting to index.html from login.html");
                window.location.href = 'index.html';
            }
        } else {
            // User is signed out.
            console.log("User is signed out.");
            
            // Clear the cached API key on logout.
            clearApiKey();

            if (currentPage !== 'login.html') {
                // If not on login page, redirect to the login page.
                console.log("Redirecting to login.html");
                window.location.href = 'login.html';
            }
        }
    });
});
