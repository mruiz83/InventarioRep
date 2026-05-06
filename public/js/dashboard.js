document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.getElementById('chartEquipos');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Leemos los datos que EJS inyectó en el HTML
    const totalEquipos = parseInt(canvas.dataset.totalEquipos) || 0;
    const asignados = parseInt(canvas.dataset.asignados) || 0;
    const totalColab = parseInt(canvas.dataset.totalColab) || 0;
    const colabConEquipo = parseInt(canvas.dataset.colabEquipo) || 0;

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Equipos', 'Colaboradores'],
            datasets: [
                {
                    label: 'Total General',
                    data: [totalEquipos, totalColab],
                    backgroundColor: '#e9ecef',
                    borderRadius: 5
                },
                {
                    label: 'Asignados',
                    data: [asignados, colabConEquipo],
                    backgroundColor: '#0d6efd',
                    borderRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
});