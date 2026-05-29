document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();

    // If user is already logged in, redirect to the main page.
    auth.onAuthStateChanged(user => {
        if (user) {
            window.location.href = 'index.html';
        }
    });

    const loginForm = document.getElementById('login-form');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const spinner = submitBtn.querySelector('.spinner');
    const errorMessage = document.getElementById('error-message');

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Show spinner and disable button
        btnText.classList.add('hidden');
        spinner.classList.remove('hidden');
        submitBtn.disabled = true;
        errorMessage.textContent = '';

        const email = loginForm.email.value;
        const password = loginForm.password.value;

        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Signed in, redirect to the main page.
                window.location.href = 'index.html';
            })
            .catch((error) => {
                let message = 'Произошла ошибка. Попробуйте снова.';
                switch (error.code) {
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                    case 'auth/invalid-credential':
                        message = 'Неверный email или пароль.';
                        break;
                    case 'auth/invalid-email':
                        message = 'Некорректный формат email.';
                        break;
                }
                errorMessage.textContent = message;
                
                // Hide spinner and re-enable button
                btnText.classList.remove('hidden');
                spinner.classList.add('hidden');
                submitBtn.disabled = false;
            });
    });
});
