const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const db = require('./db'); 
require('dotenv').config();

const app = express();

app.set('trust proxy', true);
app.use(express.static('public'));

// CONFIGURACIÓN Y MIDDLEWARES
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); 

app.use(session({
    secret: 'secreto_enacal_2026',
    resave: false,
    saveUninitialized: false
}));
app.use(flash());

// Definir función -- para restringir ruras a usuarios
const restringirA = (rolesPermitidos) => {
    return (req, res, next) => {
        if (req.session.loggedin) {
            if (rolesPermitidos.includes(req.session.rol)) {
                return next();
            }
            req.flash('error', 'No tienes permiso para acceder a este módulo');
            return res.redirect('/dashboard');
        }
        res.redirect('/');
    };
};



app.use((req, res, next) => {
    res.locals.messages = req.flash();
    res.locals.userRol = req.session.rol || null; 
    next();
});



// Ruta de acceso (Login/Logout/Dashboard)
app.get('/', (req, res) => { res.render('login'); });

app.post('/auth/login', async (req, res) => {
    const { usuario, password } = req.body; 
    try {
        const [rows] = await db.query('SELECT * FROM usuarios WHERE usuario = ? AND contraseña = ?', [usuario, password]);
        if (rows.length > 0) {
            req.session.loggedin = true;
            req.session.id_usuario = rows[0].id_usuarios;
            req.session.nombreReal = rows[0].nombre;
            req.session.rol = rows[0].id_rol;
            res.redirect('/dashboard'); 
        } else {
            req.flash('error', 'Usuario o contraseña incorrectos');
            res.redirect('/');
        }
    } catch (error) { res.status(500).send('Error en el servidor.'); }
});

// Ruta para el dashboard corregida 05/06/2026
app.get('/dashboard', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    try {
        // Consultas reales a tu base de datos
        const [equipos] = await db.query('SELECT COUNT(*) as total FROM equipos');
        const [asignados] = await db.query('SELECT COUNT(*) as total FROM equipos WHERE estado = "Asignado"');
        const [colaboradores] = await db.query('SELECT COUNT(*) as total FROM colaboradores');
        
        // Calcular stock crítico
        const [stockCritico] = await db.query(`
            SELECT COUNT(*) as total 
            FROM repuestos r
            WHERE (
                SELECT IFNULL(SUM(e.cantidad), 0) FROM entradas e WHERE e.id_repuestos = r.id_repuestos
            ) - (
                SELECT IFNULL(SUM(s.cantidad), 0) FROM salidas s WHERE s.id_repuestos = r.id_repuestos
            ) <= 0
        `);
        
        const [stockMinimo] = await db.query(`
            SELECT COUNT(*) as total 
            FROM repuestos r
            WHERE (
                SELECT IFNULL(SUM(e.cantidad), 0) FROM entradas e WHERE e.id_repuestos = r.id_repuestos
            ) - (
                SELECT IFNULL(SUM(s.cantidad), 0) FROM salidas s WHERE s.id_repuestos = r.id_repuestos
            ) < 5
        `);

        res.render('dashboard', {
            nombre: req.session.nombreReal,
            rol: req.session.rol,
            totalEquipos: equipos[0].total,
            asignados: asignados[0].total,
            totalColab: colaboradores[0].total,
            colabConEquipo: asignados[0].total,
            stockCero: stockCritico[0].total,
            stockMinimo: stockMinimo[0].total,
            pagina: 'inicio'
        });
    } catch (error) {
        console.error("Error al cargar dashboard:", error);
        res.render('dashboard', { 
            nombre: req.session.nombreReal,
            rol: req.session.rol,
            totalEquipos: 0, 
            asignados: 0, 
            totalColab: 0, 
            colabConEquipo: 0, 
            stockCero: 0, 
            stockMinimo: 0,
            pagina: 'inicio'
        });
    }
});


app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Módulo: Repuestos y entradas
app.get('/repuestos', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    try {
        const query = `
            SELECT 
                r.id_repuestos,
                r.nombre,
                r.descripcion,
                r.marca,
                r.modelo,
                r.capacidad,
                r.serie,
                r.tipo,
                r.estado,
                r.aplicacion,
                (
                    SELECT IFNULL(SUM(e.cantidad), 0) 
                    FROM entradas e 
                    WHERE e.id_repuestos = r.id_repuestos
                ) - (
                    SELECT IFNULL(SUM(s.cantidad), 0) 
                    FROM salidas s 
                    WHERE s.id_repuestos = r.id_repuestos
                ) AS stock_total
            FROM repuestos r
            ORDER BY r.id_repuestos
        `;
        
        const [repuestos] = await db.query(query);
        
        // Corregido 05/06/2026
        res.render('repuestos', { 
            repuestos: repuestos,
            nombre: req.session.nombreReal,
            rol: req.session.rol,
            pagina: 'repuestos'
        });
        
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Error al cargar inventario");
    }
});


app.get('/entradas', async (req, res) => {
    if (req.session.loggedin) {
        const [rows] = await db.query('SELECT id_repuestos, descripcion FROM repuestos');
        res.render('entradas', { nombre: req.session.nombreReal, repuestos: rows, pagina: 'entradas' });
    } else { res.redirect('/'); }
});

app.post('/entradas/guardar', async (req, res) => {
    let { id_repuesto, cantidad, factura, proveedor } = req.body;
    if (!Array.isArray(id_repuesto)) {
        id_repuesto = id_repuesto ? [id_repuesto] : [];
        cantidad = cantidad ? [cantidad] : [];
    }
    try {
        for (let i = 0; i < id_repuesto.length; i++) {
            if (id_repuesto[i]) {
                await db.query(
                    'INSERT INTO entradas (id_repuestos, cantidad, fecha_entrada, id_usuarios, orden, observaciones) VALUES (?, ?, NOW(), ?, ?, ?)',
                    [id_repuesto[i], cantidad[i], req.session.id_usuario, factura[i] || null, proveedor[i] || 'Ingreso manual']
                );
            }
        }
        req.flash('success', '✅ Stock actualizado.');
        res.redirect('/repuestos');
    } catch (error) { res.status(500).send('Error en base de datos'); }
});


// Salidas
app.get('/salidas', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    try {
        // Acá calculamos el Stock de repuestos disponible
        const query = `
            SELECT 
                r.id_repuestos, 
                r.descripcion, 
                (IFNULL((SELECT SUM(e.cantidad) FROM entradas e WHERE e.id_repuestos = r.id_repuestos), 0) - 
                 IFNULL((SELECT SUM(s.cantidad) FROM salidas s WHERE s.id_repuestos = r.id_repuestos), 0)) AS stock
            FROM repuestos r
            HAVING stock > 0`;

        const [rows] = await db.query(query);
        
        res.render('salidas', { 
            nombre: req.session.nombreReal, 
            repuestos: rows, 
            pagina: 'salidas' 
        });
    } catch (error) {
        console.error("Error en GET /salidas:", error);
        res.status(500).send("Error al calcular el stock disponible.");
    }
});


app.post('/salidas/guardar', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');

    console.log("=== DEPURACIÓN: Inicio de guardado de salida ===");
    console.log("Body recibido:", req.body);

    let { 
        fecha_salida, 
        orden, 
        equipo, 
        id_repuestos, 
        cantidad, 
        observaciones 
    } = req.body;

    // 🔥 CORREGIDO: Acepta tanto con corchetes como sin corchetes
    const listaIds = Array.isArray(id_repuestos) ? id_repuestos : (id_repuestos ? [id_repuestos] : []);
    const listaCants = Array.isArray(cantidad) ? cantidad : (cantidad ? [cantidad] : []);
    const listaObs = Array.isArray(observaciones) ? observaciones : (observaciones ? [observaciones] : []);

    console.log("listaIds procesada:", listaIds);
    console.log("listaCants procesada:", listaCants);
    console.log("listaObs procesada:", listaObs);

    try {
        for (let i = 0; i < listaIds.length; i++) {
            if (listaIds[i] && parseInt(listaCants[i]) > 0) {
                
                console.log(`Procesando item ${i}: ID=${listaIds[i]}, Cantidad=${listaCants[i]}`);
                
                // Validar stock antes de insertar
                const [stockCheck] = await db.query(`
                    SELECT 
                        (SELECT IFNULL(SUM(e.cantidad), 0) FROM entradas e WHERE e.id_repuestos = ?) 
                        - (SELECT IFNULL(SUM(s.cantidad), 0) FROM salidas s WHERE s.id_repuestos = ?) 
                        AS stock_actual
                `, [listaIds[i], listaIds[i]]);
                
                const stockActual = parseInt(stockCheck[0].stock_actual);
                const cantidadSalida = parseInt(listaCants[i]);
                
                console.log(`Stock actual: ${stockActual}, Cantidad a salir: ${cantidadSalida}`);
                
                if (cantidadSalida > stockActual) {
                    console.log(`❌ Stock insuficiente para ID ${listaIds[i]}`);
                    req.flash('error', `Stock insuficiente. Disponible: ${stockActual}`);
                    return res.redirect('/salidas');
                }
                
                // Insertar salida
                const sqlInsert = `
                    INSERT INTO salidas 
                    (id_repuestos, cantidad, fecha_salida, id_usuarios, orden, equipo, observaciones) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `;
                
                const valores = [
                    listaIds[i], 
                    cantidadSalida, 
                    fecha_salida, 
                    req.session.id_usuario, 
                    orden, 
                    equipo, 
                    listaObs[i] || ''
                ];
                
                console.log("Ejecutando INSERT...");
                const [resultado] = await db.query(sqlInsert, valores);
                console.log(`✅ Inserción exitosa. ID de salida: ${resultado.insertId}`);
            }
        }
        
        console.log("=== Todas las salidas procesadas correctamente ===");
        req.flash('success', '✅ Salida registrada correctamente');
        res.redirect('/repuestos');
        
    } catch (error) {
        console.error("❌ ERROR:", error);
        req.flash('error', 'Error al registrar la salida: ' + error.message);
        res.redirect('/salidas');
    }
});

// Registro de equipos
app.get('/inventario/equipos', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    try {
        // 🔥 Asegúrate de que esta consulta sea DISTINCT o única
        const [tipos] = await db.query('SELECT * FROM tipos_equipo ORDER BY nombre_tipo ASC');
        
        const [marcas] = await db.query('SELECT * FROM marcas ORDER BY nombre_marca ASC');
        
        const sqlEquipos = `
            SELECT e.*, c.nombre_completo AS nombre_colaborador, d.nombre_dependencia 
            FROM equipos e
            LEFT JOIN colaboradores c ON e.id_colaborador = c.id_colaborador
            LEFT JOIN dependencias d ON c.id_dependencia = d.id_dependencia
            ORDER BY e.id_equipo DESC`;
        const [equipos] = await db.query(sqlEquipos);

        const [colaboradores] = await db.query(`
            SELECT
                c.id_colaborador, 
                c.nombre_completo, 
                d.id_dependencia, 
                d.nombre_dependencia 
            FROM colaboradores c
            JOIN dependencias d ON c.id_dependencia = d.id_dependencia
            WHERE estado_laboral = 'Activo' 
            ORDER BY nombre_completo ASC`);

        // 🔥 Depuración: Ver cuántos tipos estás enviando
        console.log("Tipos de equipo encontrados:", tipos.length);
        console.log("Tipos:", JSON.stringify(tipos, null, 2));

        res.render('registro_equipos', { 
            nombre: req.session.nombreReal, 
            tipos: tipos,       // 👈 Asegúrate que sea solo 'tipos'
            marcas: marcas,     // 👈 Y que no se esté pisando con otra variable
            equipos: equipos, 
            colaboradores: colaboradores, 
            pagina: 'registro_equipos' 
        });
        
    } catch (error) { 
        console.error(error);
        res.status(500).send("Error: " + error.message); 
    }
});


app.get('/api/modelos/:id_tipo/:id_marca', async (req, res) => {
    const { id_tipo, id_marca } = req.params;
    try {
        const [rows] = await db.query(
            'SELECT id_modelo, nombre_modelo FROM modelos WHERE id_tipo = ? AND id_marca = ?', 
            [id_tipo, id_marca]
        );
        res.json(rows);
    } catch (error) { res.status(500).json({ error: "Error API" }); }
});


app.post('/inventario/equipos/guardar', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');

    const { id_tipo, id_marca, id_modelo, serie, id_colaborador, codigo_inventario, estado } = req.body;

    try {
        const [tipo] = await db.query('SELECT * FROM tipos_equipo WHERE id_tipo = ?', [id_tipo]);
        const [marca] = await db.query('SELECT nombre_marca FROM marcas WHERE id_marca = ?', [id_marca]);
        const [modelo] = await db.query('SELECT nombre_modelo FROM modelos WHERE id_modelo = ?', [id_modelo]);

        const [datosColaborador] = await db.query(`
            SELECT d.nombre_dependencia 
            FROM colaboradores c
            JOIN dependencias d ON c.id_dependencia = d.id_dependencia
            WHERE c.id_colaborador = ?
        `, [id_colaborador]);

        const oficinaFinal = datosColaborador.length > 0 
            ? datosColaborador[0].nombre_dependencia.toUpperCase() 
            : 'TECNOLOGIA';

        // 🔥 NUEVO: Calcular el código informático automáticamente desde la base de datos
        // Esto evita depender de 'ultimo_numero' que puede estar desactualizado
        
        // 1. Obtener el máximo número REAL usado para este prefijo
        const [maxExistente] = await db.query(
            `SELECT MAX(CAST(SUBSTRING(codigo_informatico, ?) AS UNSIGNED)) as max_num
             FROM equipos 
             WHERE codigo_informatico LIKE ?`,
            [tipo[0].prefijo.length + 1, `${tipo[0].prefijo}%`]
        );
        
        let num = (maxExistente[0].max_num || 0) + 1;
        let codInf = `${tipo[0].prefijo}${num.toString().padStart(4, '0')}`;
        
        // 2. Verificar que el código no exista (por si acaso)
        let existe = true;
        let intentos = 0;
        const maxIntentos = 100;
        
        while (existe && intentos < maxIntentos) {
            const [verificar] = await db.query(
                'SELECT COUNT(*) as total FROM equipos WHERE codigo_informatico = ?',
                [codInf]
            );
            
            if (verificar[0].total > 0) {
                num++;
                codInf = `${tipo[0].prefijo}${num}`;
                intentos++;
            } else {
                existe = false;
            }
        }
        
        if (existe) {
            throw new Error('No se pudo generar un código único después de varios intentos');
        }

        const marcaModelo = `${marca[0]?.nombre_marca || 'GENERICA'} ${modelo[0]?.nombre_modelo || 'S/M'}`.toUpperCase();
        const codInv = codigo_inventario ? codigo_inventario.toUpperCase().trim() : codInf;
        const estadoFinal = estado || 'Operativo';

        const sql = `
            INSERT INTO equipos 
            (codigo_inventario, codigo_informatico, tipo_equipo, marca_modelo, serie, id_colaborador, area_departamento, estado, fecha_registro) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;

        await db.query(sql, [
            codInv, 
            codInf, 
            tipo[0].nombre_tipo.toUpperCase(),
            marcaModelo, 
            serie.toUpperCase().trim(),
            id_colaborador, 
            oficinaFinal, 
            estadoFinal
        ]);

        // 🔥 Actualizar el último_numero en tipos_equipo para mantener consistencia (opcional)
        await db.query('UPDATE tipos_equipo SET ultimo_numero = ? WHERE id_tipo = ?', [num, id_tipo]);
        
        req.flash('success', `✅ Equipo registrado correctamente. Código: ${codInf}`);
        res.redirect('/inventario/equipos');

    } catch (error) {
        console.error("Error SQL:", error.message);
        req.flash('error', 'Error en registro: ' + error.message);
        res.redirect('/inventario/equipos');
    }
});



// Editar los datos de un equipo
app.post('/inventario/equipos/actualizar', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');

    const { id_equipo, serie, estado, id_colaborador } = req.body;

    try {
        // Nueva oficina
        const [datosCol] = await db.query(`
            SELECT d.nombre_dependencia 
            FROM colaboradores c
            JOIN dependencias d ON c.id_dependencia = d.id_dependencia
            WHERE c.id_colaborador = ?`, [id_colaborador]);

        const nuevaOficina = datosCol[0].nombre_dependencia.toUpperCase();

        // Actualizar equipo
        const sql = `
            UPDATE equipos 
            SET serie = ?, estado = ?, id_colaborador = ?, area_departamento = ?
            WHERE id_equipo = ?
        `;

        await db.query(sql, [serie.toUpperCase(), estado, id_colaborador, nuevaOficina, id_equipo]);
        
        res.redirect('/inventario/equipos');
    } catch (error) {
        res.status(500).send("Error al actualizar: " + error.message);
    }
});


// En esta área se configuraran loa catálogos, equipo y áreas de la institución
app.get('/configuracion/catalogo', async (req, res) => {
    if (req.session.loggedin) {
        try {
            const [tipos] = await db.query('SELECT * FROM tipos_equipo ORDER BY nombre_tipo ASC');
            const [marcas] = await db.query('SELECT * FROM marcas ORDER BY nombre_marca ASC');
            const [modelos] = await db.query(`
                SELECT m.id_modelo, m.nombre_modelo, t.nombre_tipo, ma.nombre_marca 
                FROM modelos m
                JOIN tipos_equipo t ON m.id_tipo = t.id_tipo
                JOIN marcas ma ON m.id_marca = ma.id_marca
                ORDER BY t.nombre_tipo, ma.nombre_marca ASC
            `);
            res.render('catalogo_equipos', { 
                nombre: req.session.nombreReal, tipos, marcas, modelos, pagina: 'catalogo_equipos' });
        } catch (error) { res.status(500).send("Error en Catálogo"); }
    } else { res.redirect('/'); }
});

app.post('/catalogo/marcas/guardar', async (req, res) => {
    try {
        let { nombre_marca } = req.body;
        if (!nombre_marca) return res.status(400).send("Nombre requerido");
        await db.query('INSERT INTO marcas (nombre_marca) VALUES (?)', [nombre_marca.toUpperCase().trim()]);
        res.redirect('/configuracion/catalogo');
    } catch (error) { res.status(500).send("Error al guardar marca"); }
});

app.post('/catalogo/modelos/guardar', async (req, res) => {
    try {
        const { id_tipo, id_marca, nombre_modelo } = req.body;
        await db.query('INSERT INTO modelos (id_tipo, id_marca, nombre_modelo) VALUES (?, ?, ?)', 
            [id_tipo, id_marca, nombre_modelo.toUpperCase().trim()]);
        res.redirect('/configuracion/catalogo');
    } catch (error) { res.status(500).send("Error al guardar modelo"); }
});

app.get('/configuracion/areas', async (req, res) => {
    if (req.session.loggedin) {
        const query = `SELECT a.*, p.nombre_dependencia AS nombre_padre FROM dependencias a LEFT JOIN dependencias p ON a.id_padre = p.id_dependencia ORDER BY a.nivel, a.nombre_dependencia ASC`;
        const [rows] = await db.query(query);
        res.render('areas', { nombre: req.session.nombreReal, areas: rows, pagina: 'configuracion' });
    } else { res.redirect('/'); }
});



app.post('/configuracion/areas/guardar', restringirA([1]), async (req, res) => {
    const { nombre_dependencia, nivel, id_padre } = req.body;
    
    const padreFinal = id_padre === "" ? null : id_padre;

    try {
        await db.query(
            'INSERT INTO dependencias (nombre_dependencia, nivel, id_padre) VALUES (?, ?, ?)', 
            [nombre_dependencia.toUpperCase().trim(), nivel, padreFinal]
        );
        req.flash('success', 'Área guardada exitosamente');
        res.redirect('/configuracion/areas');
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al guardar el área institucional");
    }
});


// Módulo de Colaboradores -- en teoría debe ser con permisos de administardor
app.get('/configuracion/colaboradores', restringirA([1]), async (req, res) => {
    try {
        const [empleados] = await db.query(`
            SELECT c.*, d.nombre_dependencia 
            FROM colaboradores c 
            LEFT JOIN dependencias d ON c.id_dependencia = d.id_dependencia 
            ORDER BY c.nombre_completo ASC
        `);
        
        const [areas] = await db.query('SELECT id_dependencia, nombre_dependencia FROM dependencias ORDER BY nombre_dependencia');
        
        res.render('colaboradores', { 
            nombre: req.session.nombreReal, 
            colaboradores: empleados, 
            areas, 
            pagina: 'colaboradores' 
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al cargar el módulo de colaboradores");
    }
});


app.post('/configuracion/colaboradores/guardar', restringirA([1]), async (req, res) => {
    const { nombre_completo, numero_empleado, id_dependencia, cargo, extension_telefonica } = req.body;
    try {
        await db.query(
            'INSERT INTO colaboradores (nombre_completo, numero_empleado, id_dependencia, cargo, extension_telefonica) VALUES (?, ?, ?, ?, ?)', 
            [nombre_completo, numero_empleado, id_dependencia, cargo, extension_telefonica]
        );
        res.redirect('/configuracion/colaboradores');
    } catch (error) {
        res.status(500).send("Error al guardar colaborador");
    }
});


// API para obtener los datos de un solo colaborador (usada por el Modal)
app.get('/api/colaborador/:id', restringirA([1]), async (req, res) => {
    try {

        const [rows] = await db.query('SELECT * FROM colaboradores WHERE id_colaborador = ?', [req.params.id]);
        
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ error: "Colaborador no encontrado" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ruta para actualización de datos
app.post('/configuracion/colaboradores/actualizar', restringirA([1]), async (req, res) => {
    const { 
        id_colaborador, 
        nombre_completo, 
        numero_empleado, 
        cargo, 
        id_dependencia, 
        extension_telefonica, 
        estado_laboral 
    } = req.body;

    try {
        const sql = `
            UPDATE colaboradores 
            SET nombre_completo = ?, 
                numero_empleado = ?, 
                cargo = ?, 
                id_dependencia = ?, 
                extension_telefonica = ?, 
                estado_laboral = ?
            WHERE id_colaborador = ?`;

        await db.query(sql, [
            nombre_completo, 
            numero_empleado, 
            cargo, 
            id_dependencia, 
            extension_telefonica, 
            estado_laboral,
            id_colaborador
        ]);

        req.flash('success', '✅ Información actualizada correctamente');
        res.redirect('/configuracion/colaboradores');
    } catch (error) {
        console.error(error);
        res.status(500).send("Error al actualizar la información del colaborador");
    }
});


// Taller y recepción
app.get('/taller/recepcion', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    try {
        // Obtener equipos
        const [listaEquipos] = await db.query(`
            SELECT id_equipo, codigo_informatico, marca_modelo, codigo_inventario, area_departamento, serie 
            FROM equipos 
            ORDER BY codigo_informatico ASC
        `);
        
        // Obtener técnicos (todos los usuarios)
        const [tecnicos] = await db.query(`
            SELECT id_usuarios, nombre 
            FROM usuarios 
            ORDER BY nombre ASC
        `);
        
        // Obtener ingresos con datos completos para el datagrid
        const [ingresos] = await db.query(`
            SELECT 
                r.id_recepcion,
                r.fecha_ingreso,
                r.falla_reportada,
                r.accesorios,
                r.quien_entrega,
                r.estado_reparacion,
                e.codigo_informatico,
                e.marca_modelo,
                u.nombre AS nombre_tecnico
            FROM recepcion_equipos r 
            JOIN equipos e ON r.id_equipo = e.id_equipo 
            LEFT JOIN usuarios u ON r.tecnico_asignado = u.id_usuarios 
            ORDER BY r.fecha_ingreso DESC
        `);
        
        console.log("✅ Equipos encontrados:", listaEquipos.length);
        console.log("✅ Técnicos encontrados:", tecnicos.length);
        console.log("✅ Órdenes encontradas:", ingresos.length);
        
        res.render('recepcion', { 
            nombre: req.session.nombreReal,
            rol: req.session.rol,
            ingresos, 
            listaEquipos, 
            listaTecnicos: tecnicos, 
            pagina: 'taller' 
        });
        
    } catch(error) {
        console.error("❌ Error en recepción:", error);
        req.flash('error', 'Error al cargar la página de recepción');
        res.redirect('/dashboard');
    }
});


// Guardar recepción de equipo
app.post('/taller/recepcion/guardar', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');

    const { id_equipo, tecnico_asignado, quien_entrega, accesorios, falla_reportada } = req.body;

    // Validaciones básicas
    if (!id_equipo || !tecnico_asignado || !quien_entrega || !falla_reportada) {
        req.flash('error', 'Todos los campos obligatorios deben ser llenados');
        return res.redirect('/taller/recepcion');
    }

    try {
        // Insertar en recepcion_equipos
        const [result] = await db.query(`
            INSERT INTO recepcion_equipos 
            (id_equipo, fecha_ingreso, falla_reportada, accesorios, quien_entrega, estado_reparacion, tecnico_asignado, notas_adicionales) 
            VALUES (?, NOW(), ?, ?, ?, 'Pendiente', ?, ?)
        `, [id_equipo, falla_reportada, accesorios || null, quien_entrega, tecnico_asignado, null]);

        req.flash('success', `✅ Orden de servicio #${result.insertId} registrada correctamente`);
        res.redirect('/taller/recepcion');

    } catch (error) {
        console.error("Error al guardar recepción:", error);
        req.flash('error', 'Error al registrar la orden: ' + error.message);
        res.redirect('/taller/recepcion');
    }
});


// Imprimir orden de servicio
app.get('/taller/recepcion/imprimir/:id_recepcion', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');

    const { id_recepcion } = req.params;

    try {
        const [ordenes] = await db.query(`
            SELECT 
                r.*,
                e.codigo_informatico,
                e.marca_modelo,
                e.serie,
                e.area_departamento,
                u.nombre AS tecnico_nombre
            FROM recepcion_equipos r
            JOIN equipos e ON r.id_equipo = e.id_equipo
            LEFT JOIN usuarios u ON r.tecnico_asignado = u.id_usuarios
            WHERE r.id_recepcion = ?
        `, [id_recepcion]);

        if (ordenes.length === 0) {
            req.flash('error', 'Orden no encontrada');
            return res.redirect('/taller/recepcion');
        }

        res.render('imprimir_orden', { orden: ordenes[0] });

    } catch (error) {
        console.error("Error al imprimir orden:", error);
        req.flash('error', 'Error al generar la orden');
        res.redirect('/taller/recepcion');
    }
});


// Marcar equipo como entregado
app.get('/taller/recepcion/entregar/:id_recepcion', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');

    const { id_recepcion } = req.params;

    try {
        await db.query(`
            UPDATE recepcion_equipos 
            SET estado_reparacion = 'Entregado' 
            WHERE id_recepcion = ?
        `, [id_recepcion]);

        req.flash('success', '✅ Equipo marcado como entregado');
        res.redirect('/taller/recepcion');

    } catch (error) {
        console.error("Error al entregar equipo:", error);
        req.flash('error', 'Error al actualizar estado');
        res.redirect('/taller/recepcion');
    }
});


// UComponente NPM para mostrar fecha y hora (en construccción) ------
const dataHora = require('data-hora'); // Para importamos el paquete data-hora

app.get('/dashboard', async (req, res) => {
    try {
        // Consultas reales a tu base de datos SQL
        const [equipos] = await db.query('SELECT COUNT(*) as total FROM equipos');
        const [asignados] = await db.query('SELECT COUNT(*) as total FROM equipos WHERE estado = "Asignado"');
        const [colaboradores] = await db.query('SELECT COUNT(*) as total FROM colaboradores');

        // Enviar resultados a los datos reales
        res.render('dashboard', {
            nombre: "Tu Nombre", // Nombre de inicio de sesión
            totalEquipos: equipos[0].total,
            asignados: asignados[0].total,
            totalColab: colaboradores[0].total,
            colabConEquipo: asignados[0].total, 
            stockCero: 0, 
            stockMinimo: 0
        });
    } catch (error) {
        console.error("Error al cargar datos:", error);
        res.render('dashboard', { 
            nombre: "Usuario", 
            totalEquipos: 0, asignados: 0, totalColab: 0, colabConEquipo: 0, stockCero: 0, stockMinimo: 0 
        });
    }
});




// Para arrancar el Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en: http://localhost:${PORT}`);
});