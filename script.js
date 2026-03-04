// Lógica da Landing Page de A Conquista de Arcádia

document.addEventListener('DOMContentLoaded', () => {

    // Efeito Glitch aleatório leve no título (caso quisermos programático além do CSS)
    const glitchTitle = document.querySelector('.glitch-text');
    if (glitchTitle) {
        setInterval(() => {
            glitchTitle.style.transform = `translate(${Math.random() * 4 - 2}px, ${Math.random() * 4 - 2}px)`;
            setTimeout(() => {
                glitchTitle.style.transform = `translate(0px, 0px)`;
            }, 50);
        }, 3000);
    }

    // Scroll Suave para links internos anchor
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

});

// Função disparada no SUBMIT do formulário do Terminal (Acesso ao Beta)
function showSuccess() {
    const successMsg = document.getElementById('success-message');
    const inputField = document.querySelector('.terminal-form input');

    // Limpa o input
    inputField.value = '';

    // Mostra mensagem de sucesso
    successMsg.classList.remove('hidden');

    // Efeito visual no botão e form
    const formGroup = document.querySelector('.input-group');
    formGroup.style.borderColor = 'var(--neon-green)';
    formGroup.style.boxShadow = '0 0 20px rgba(0,255,136,0.3)';

    // Esconde a mensagem e reseta o estilo depois de 4.5s
    setTimeout(() => {
        successMsg.classList.add('hidden');
        formGroup.style.borderColor = 'var(--panel-border)';
        formGroup.style.boxShadow = 'none';
    }, 4500);
}
