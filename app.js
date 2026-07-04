const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const db = require('./db');
const authRoutes = require('./controllers/authRoutes');
const { attachUserContext, restrictTo: restringirA } = require('./middleware/auth');
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
app.use(attachUserContext);
app.use(authRoutes);







// Ruta para el dashboard corregida 05/06/2026
app.get('/dashboard', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    try {
        // ============================================
        // 1. EQUIPOS POR ESTADO
        
        // Total de equipos registrados
        const [equipos] = await db.query('SELECT COUNT(*) as total FROM equipos');
        
        // Equipos en buen estado (Operativo)
        const [equiposBuenEstado] = await db.query(`
            SELECT COUNT(*) as total 
            FROM equipos 
            WHERE estado = 'Operativo'
        `);
        
        // Equipos en resguardo (Reserva)
        const [equiposResguardo] = await db.query(`
            SELECT COUNT(*) as total 
            FROM equipos 
            WHERE estado = 'Reserva'
        `);
        
        // Equipos en reparación o baja
        const [equiposOtros] = await db.query(`
            SELECT COUNT(*) as total 
            FROM equipos 
            WHERE estado IN ('En Reparacion', 'De Baja')
        `);
        
        // ============================================
        // 2. COLABORADORES (se mantiene igual)
        // ============================================
        
        const [colaboradores] = await db.query(`
            SELECT COUNT(*) as total 
            FROM colaboradores 
            WHERE estado_laboral = 'Activo'
        `);
        
        const [colabConEquipo] = await db.query(`
            SELECT COUNT(DISTINCT id_colaborador) as total 
            FROM equipos 
            WHERE id_colaborador IS NOT NULL
        `);
        
        // ============================================
        // 3. STOCK DE REPUESTOS
        // ============================================
        
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
            ) > 0 
            AND (
                SELECT IFNULL(SUM(e.cantidad), 0) FROM entradas e WHERE e.id_repuestos = r.id_repuestos
            ) - (
                SELECT IFNULL(SUM(s.cantidad), 0) FROM salidas s WHERE s.id_repuestos = r.id_repuestos
            ) < 5
        `);
        
        const [stockSaludable] = await db.query(`
            SELECT COUNT(*) as total 
            FROM repuestos r
            WHERE (
                SELECT IFNULL(SUM(e.cantidad), 0) FROM entradas e WHERE e.id_repuestos = r.id_repuestos
            ) - (
                SELECT IFNULL(SUM(s.cantidad), 0) FROM salidas s WHERE s.id_repuestos = r.id_repuestos
            ) >= 5
        `);
        
        // ============================================
        // 4. ÓRDENES DE TRABAJO
        // ============================================
        
        const [ordenesPendientes] = await db.query(`
            SELECT COUNT(*) as total 
            FROM recepcion_equipos 
            WHERE estado_reparacion IN ('Pendiente', 'En Proceso')
        `);
        
        const [ordenesReparadas] = await db.query(`
            SELECT COUNT(*) as total 
            FROM recepcion_equipos 
            WHERE estado_reparacion = 'Reparado'
        `);
        
        const [ordenesEntregadas] = await db.query(`
            SELECT COUNT(*) as total 
            FROM recepcion_equipos 
            WHERE estado_reparacion = 'Entregado'
        `);

        // ============================================
        // 5. DEBUG (ver en consola del servidor)
        // ============================================
        console.log('========== DASHBOARD DATA ==========');
        console.log('Total Equipos:', equipos[0].total);
        console.log('Equipos Buen Estado:', equiposBuenEstado[0].total);
        console.log('Equipos en Resguardo:', equiposResguardo[0].total);
        console.log('Equipos en Reparación/Baja:', equiposOtros[0].total);
        console.log('Total Colaboradores:', colaboradores[0].total);
        console.log('Colaboradores con Equipo:', colabConEquipo[0].total);
        console.log('====================================');

        res.render('dashboard', {
            nombre: req.session.nombreReal,
            rol: req.session.rol,
            totalEquipos: equipos[0].total,
            equiposBuenEstado: equiposBuenEstado[0].total,
            equiposResguardo: equiposResguardo[0].total,
            equiposOtros: equiposOtros[0].total,
            totalColab: colaboradores[0].total,
            colabConEquipo: colabConEquipo[0].total,
            stockCritico: stockCritico[0].total,
            stockMinimo: stockMinimo[0].total,
            stockSaludable: stockSaludable[0].total,
            ordenesPendientes: ordenesPendientes[0].total,
            ordenesReparadas: ordenesReparadas[0].total,
            ordenesEntregadas: ordenesEntregadas[0].total,
            pagina: 'inicio'
        });
        
    } catch (error) {
        console.error("Error al cargar dashboard:", error);
        res.render('dashboard', { 
            nombre: req.session.nombreReal,
            rol: req.session.rol,
            totalEquipos: 0, 
            equiposBuenEstado: 0, 
            equiposResguardo: 0,
            equiposOtros: 0,
            totalColab: 0, 
            colabConEquipo: 0,
            stockCritico: 0,
            stockMinimo: 0,
            stockSaludable: 0,
            ordenesPendientes: 0,
            ordenesReparadas: 0,
            ordenesEntregadas: 0,
            pagina: 'inicio'
        });
    }
});


app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});


const ExcelJS = require('exceljs');

// ============================================
// REPORTE DE REPUESTOS A EXCEL
// ============================================
app.get('/reporte/repuestos/excel', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    try {
        const { filtro } = req.query;
        
        // Construir la consulta según el filtro
        let query = `
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
                    SELECT IFNULL(SUM(e.cantidad), 0) FROM entradas e WHERE e.id_repuestos = r.id_repuestos
                ) - (
                    SELECT IFNULL(SUM(s.cantidad), 0) FROM salidas s WHERE s.id_repuestos = r.id_repuestos
                ) AS stock_actual
            FROM repuestos r
        `;
        
        // Aplicar filtro si es necesario
        if (filtro === 'nuevo') {
            query += " WHERE r.estado = 'Nuevo'";
        } else if (filtro === 'usado') {
            query += " WHERE r.estado = 'Usado'";
        }
        
        query += " ORDER BY r.id_repuestos ASC";
        
        const [repuestos] = await db.query(query);
        
        // Crear libro de Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Repuestos');
        
        // Definir columnas
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Nombre', key: 'nombre', width: 25 },
            { header: 'Descripción', key: 'descripcion', width: 35 },
            { header: 'Marca', key: 'marca', width: 15 },
            { header: 'Modelo', key: 'modelo', width: 15 },
            { header: 'Capacidad', key: 'capacidad', width: 12 },
            { header: 'Serie', key: 'serie', width: 15 },
            { header: 'Tipo', key: 'tipo', width: 12 },
            { header: 'Estado', key: 'estado', width: 12 },
            { header: 'Aplicación', key: 'aplicacion', width: 20 },
            { header: 'Stock Actual', key: 'stock', width: 12 }
        ];
        
        // Estilo de cabecera
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0E446B' }
        };
        worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
        
        // Agregar datos
        repuestos.forEach(repuesto => {
            worksheet.addRow({
                id: repuesto.id_repuestos,
                nombre: repuesto.nombre,
                descripcion: repuesto.descripcion,
                marca: repuesto.marca || 'N/A',
                modelo: repuesto.modelo || 'N/A',
                capacidad: repuesto.capacidad || 'N/A',
                serie: repuesto.serie || 'N/A',
                tipo: repuesto.tipo || 'N/A',
                estado: repuesto.estado,
                aplicacion: repuesto.aplicacion || 'N/A',
                stock: repuesto.stock_actual
            });
        });
        
        // Agregar fila de resumen
        worksheet.addRow({});
        worksheet.addRow({ nombre: 'TOTAL REPUESTOS:', stock: repuestos.length });
        worksheet.getRow(worksheet.rowCount).font = { bold: true };
        
        // Configurar bordes y alineación
        worksheet.eachRow((row, rowNumber) => {
            row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
        });
        
        // Configurar respuesta HTTP
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=repuestos_${new Date().toISOString().slice(0,19)}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error("Error al generar reporte de repuestos:", error);
        res.status(500).send("Error al generar el reporte");
    }
});

// ============================================
// REPORTE DE EQUIPOS A EXCEL
// ============================================
app.get('/reporte/equipos/excel', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    try {
        const { filtro } = req.query;
        
        // Construir la consulta según el filtro
        let query = `
            SELECT 
                e.id_equipo,
                e.codigo_inventario,
                e.codigo_informatico,
                e.tipo_equipo,
                e.marca_modelo,
                e.serie,
                e.area_departamento,
                e.estado,
                e.fecha_registro,
                c.nombre_completo AS responsable,
                d.nombre_dependencia AS dependencia
            FROM equipos e
            LEFT JOIN colaboradores c ON e.id_colaborador = c.id_colaborador
            LEFT JOIN dependencias d ON c.id_dependencia = d.id_dependencia
        `;
        
        // Aplicar filtro si es necesario
        if (filtro === 'asignado') {
            query += " WHERE e.id_colaborador IS NOT NULL";
        } else if (filtro === 'disponible') {
            query += " WHERE e.id_colaborador IS NULL";
        }
        
        query += " ORDER BY e.id_equipo DESC";
        
        const [equipos] = await db.query(query);
        
        // Crear libro de Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Equipos');
        
        // Definir columnas
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 8 },
            { header: 'Código Inventario', key: 'cod_inv', width: 18 },
            { header: 'Código Informático', key: 'cod_inf', width: 18 },
            { header: 'Tipo', key: 'tipo', width: 15 },
            { header: 'Marca/Modelo', key: 'marca_modelo', width: 30 },
            { header: 'Serie', key: 'serie', width: 20 },
            { header: 'Área', key: 'area', width: 25 },
            { header: 'Estado', key: 'estado', width: 12 },
            { header: 'Responsable', key: 'responsable', width: 30 },
            { header: 'Dependencia', key: 'dependencia', width: 25 },
            { header: 'Fecha Registro', key: 'fecha', width: 15 }
        ];
        
        // Estilo de cabecera
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0E446B' }
        };
        worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
        
        // Agregar datos
        equipos.forEach(equipo => {
            worksheet.addRow({
                id: equipo.id_equipo,
                cod_inv: equipo.codigo_inventario || 'N/A',
                cod_inf: equipo.codigo_informatico,
                tipo: equipo.tipo_equipo,
                marca_modelo: equipo.marca_modelo,
                serie: equipo.serie,
                area: equipo.area_departamento || 'N/A',
                estado: equipo.estado,
                responsable: equipo.responsable || 'SIN ASIGNAR',
                dependencia: equipo.dependencia || 'N/A',
                fecha: equipo.fecha_registro ? new Date(equipo.fecha_registro).toLocaleDateString() : 'N/A'
            });
        });
        
        // Agregar fila de resumen
        worksheet.addRow({});
        worksheet.addRow({ tipo: 'TOTAL EQUIPOS:', marca_modelo: equipos.length });
        worksheet.getRow(worksheet.rowCount).font = { bold: true };
        
        // Configurar bordes
        worksheet.eachRow((row, rowNumber) => {
            row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
        });
        
        // Configurar respuesta HTTP
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=equipos_${new Date().toISOString().slice(0,19)}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error("Error al generar reporte de equipos:", error);
        res.status(500).send("Error al generar el reporte");
    }
});



// ============================================
// ÓRDENES DE TRABAJO - TALLER
// ============================================


// Órdenes en Taller - SOLO las asignadas al técnico que inició sesión
app.get('/ordenes/taller', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    try {
        // Obtener órdenes de taller asignadas AL TÉCNICO QUE INICIÓ SESIÓN
        const [ordenes] = await db.query(`
            SELECT ot.*, 
                   r.id_recepcion,
                   r.falla_reportada,
                   r.quien_entrega,
                   r.accesorios,
                   e.codigo_informatico,
                   e.marca_modelo,
                   e.serie,
                   e.tipo_equipo,
                   c.nombre_completo AS colaborador_nombre,
                   c.cargo,
                   d.nombre_dependencia
            FROM ordenes_trabajo ot
            JOIN recepcion_equipos r ON ot.id_orden_referencia = r.id_recepcion
            JOIN equipos e ON r.id_equipo = e.id_equipo
            LEFT JOIN colaboradores c ON ot.id_colaborador = c.id_colaborador
            LEFT JOIN dependencias d ON c.id_dependencia = d.id_dependencia
            WHERE ot.tipo_orden = 'taller' 
              AND ot.tecnico_asignado = ?
            ORDER BY 
                CASE ot.estado 
                    WHEN 'Pendiente' THEN 1 
                    WHEN 'En Proceso' THEN 2 
                    ELSE 3 
                END,
                ot.fecha_apertura DESC
        `, [req.session.id_usuario]);
        
        const pendientes = ordenes.filter(o => o.estado === 'Pendiente').length;
        const enProceso = ordenes.filter(o => o.estado === 'En Proceso').length;
        const completadas = ordenes.filter(o => o.estado === 'Completado').length;
        
        res.render('ordenes_taller', {
            nombre: req.session.nombreReal,
            rol: req.session.rol,
            ordenes: ordenes,
            pendientes: pendientes,
            enProceso: enProceso,
            completadas: completadas,
            pagina: 'ordenes_taller'
        });
    } catch (error) {
        console.error("Error:", error);
        req.flash('error', 'Error al cargar órdenes de taller');
        res.redirect('/dashboard');
    }
});


// ============================================
// DETALLE DE ORDEN PARA ATENCIÓN DEL TÉCNICO
// ============================================
app.get('/ordenes/:id', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    const { id } = req.params;
    
    try {
        //  NUEVO: Si la orden está Pendiente, cambiarla a En Proceso automáticamente
        const [estadoActual] = await db.query(`
            SELECT estado FROM ordenes_trabajo 
            WHERE id_orden = ? AND tecnico_asignado = ?
        `, [id, req.session.id_usuario]);
        
        if (estadoActual.length > 0 && estadoActual[0].estado === 'Pendiente') {
            await db.query(`
                UPDATE ordenes_trabajo 
                SET estado = 'En Proceso' 
                WHERE id_orden = ? AND tecnico_asignado = ?
            `, [id, req.session.id_usuario]);
            console.log(`📝 Orden ${id} cambiada a En Proceso automáticamente`);
        }
        
        // Obtener datos completos de la orden
        const [ordenes] = await db.query(`
            SELECT ot.*, 
                   r.id_recepcion,
                   r.falla_reportada,
                   r.quien_entrega,
                   r.accesorios,
                   r.fecha_ingreso,
                   e.id_equipo,
                   e.codigo_informatico,
                   e.marca_modelo,
                   e.serie,
                   e.tipo_equipo,
                   e.codigo_inventario,
                   c.nombre_completo AS colaborador_nombre,
                   c.cargo,
                   c.extension_telefonica,
                   d.nombre_dependencia,
                   u.nombre AS tecnico_nombre
            FROM ordenes_trabajo ot
            LEFT JOIN recepcion_equipos r ON ot.id_orden_referencia = r.id_recepcion
            LEFT JOIN equipos e ON ot.id_equipo = e.id_equipo
            LEFT JOIN colaboradores c ON ot.id_colaborador = c.id_colaborador
            LEFT JOIN dependencias d ON c.id_dependencia = d.id_dependencia
            LEFT JOIN usuarios u ON ot.tecnico_asignado = u.id_usuarios
            WHERE ot.id_orden = ? AND ot.tecnico_asignado = ?
        `, [id, req.session.id_usuario]);
        
        if (ordenes.length === 0) {
            req.flash('error', 'Orden no encontrada o no autorizada');
            return res.redirect('/ordenes/taller');
        }
        
        const orden = ordenes[0];
        
        // Obtener repuestos ya agregados a esta orden
        const [repuestosUsados] = await db.query(`
            SELECT orp.*, r.nombre, r.descripcion, r.marca
            FROM ordenes_repuestos orp
            JOIN repuestos r ON orp.id_repuesto = r.id_repuestos
            WHERE orp.id_orden = ?
            ORDER BY orp.id_orden_repuesto DESC
        `, [id]);
        
        // Para órdenes de mantenimiento, obtener equipos adicionales
        let equiposMantenimiento = [];
        if (orden.tipo_orden === 'mantenimiento') {
            [equiposMantenimiento] = await db.query(`
                SELECT ome.*, e.codigo_informatico, e.marca_modelo, e.serie
                FROM ordenes_mantenimiento_equipos ome
                JOIN equipos e ON ome.id_equipo = e.id_equipo
                WHERE ome.id_orden = ?
            `, [id]);
        }
        
        // Obtener lista de repuestos disponibles para agregar
        const [repuestosDisponibles] = await db.query(`
            SELECT 
                r.id_repuestos,
                r.nombre,
                r.descripcion,
                r.marca,
                r.modelo,
                (
                    SELECT IFNULL(SUM(e.cantidad), 0) FROM entradas e WHERE e.id_repuestos = r.id_repuestos
                ) - (
                    SELECT IFNULL(SUM(s.cantidad), 0) FROM salidas s WHERE s.id_repuestos = r.id_repuestos
                ) AS stock_actual
            FROM repuestos r
            HAVING stock_actual > 0
            ORDER BY r.nombre ASC
        `);
        
        res.render('orden_atencion', {
            nombre: req.session.nombreReal,
            rol: req.session.rol,
            orden: orden,
            repuestosUsados: repuestosUsados,
            repuestosDisponibles: repuestosDisponibles,
            equiposMantenimiento: equiposMantenimiento,
            pagina: 'ordenes_taller'
        });
    } catch (error) {
        console.error("Error:", error);
        req.flash('error', 'Error al cargar el detalle de la orden');
        res.redirect('/ordenes/taller');
    }
});

// ============================================
// AGREGAR REPUESTO A LA ORDEN
// ============================================
app.post('/ordenes/:id/agregar-repuesto', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    const { id } = req.params;
    const { id_repuesto, cantidad } = req.body;
    
    try {
        // Validar stock
        const [stockCheck] = await db.query(`
            SELECT 
                (SELECT IFNULL(SUM(e.cantidad), 0) FROM entradas e WHERE e.id_repuestos = ?) 
                - (SELECT IFNULL(SUM(s.cantidad), 0) FROM salidas s WHERE s.id_repuestos = ?) 
                AS stock_actual
        `, [id_repuesto, id_repuesto]);
        
        const stockActual = stockCheck[0].stock_actual;
        
        if (cantidad > stockActual) {
            req.flash('error', `Stock insuficiente. Solo hay ${stockActual} unidades disponibles`);
            return res.redirect(`/ordenes/${id}`);
        }
        
        await db.query(`
            INSERT INTO ordenes_repuestos (id_orden, id_repuesto, cantidad_usada)
            VALUES (?, ?, ?)
        `, [id, id_repuesto, cantidad]);
        
        req.flash('success', '✅ Repuesto agregado correctamente');
        res.redirect(`/ordenes/${id}`);
    } catch (error) {
        console.error("Error:", error);
        req.flash('error', 'Error al agregar repuesto');
        res.redirect(`/ordenes/${id}`);
    }
});

// ============================================
// ELIMINAR REPUESTO DE LA ORDEN
// ============================================
app.post('/ordenes/:id/eliminar-repuesto/:id_orden_repuesto', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    const { id, id_orden_repuesto } = req.params;
    
    try {
        await db.query(`DELETE FROM ordenes_repuestos WHERE id_orden_repuesto = ? AND id_orden = ?`, 
            [id_orden_repuesto, id]);
        
        req.flash('success', '✅ Repuesto eliminado');
        res.redirect(`/ordenes/${id}`);
    } catch (error) {
        console.error("Error:", error);
        req.flash('error', 'Error al eliminar repuesto');
        res.redirect(`/ordenes/${id}`);
    }
});

// ============================================
// ACTUALIZAR ESTADO DE LA ORDEN
// ============================================
app.post('/ordenes/:id/actualizar-estado', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    const { id } = req.params;
    const { estado, trabajo_realizado, descontar_repuestos } = req.body;
    
    const connection = await db.getConnection();
    await connection.beginTransaction();
    
    try {
        let fecha_cierre = null;
        
        if (estado === 'Completado') {
            fecha_cierre = new Date();
            
            if (descontar_repuestos === 'on') {
                const [repuestos] = await connection.query(`
                    SELECT id_repuesto, cantidad_usada 
                    FROM ordenes_repuestos 
                    WHERE id_orden = ?
                `, [id]);
                
                for (const repuesto of repuestos) {
                    // INSERT sin id_orden_referencia
                    await connection.query(`
                        INSERT INTO salidas 
                        (id_repuestos, cantidad, fecha_salida, id_usuarios, orden, equipo, observaciones) 
                        VALUES (?, ?, NOW(), ?, ?, ?, ?)
                    `, [
                        repuesto.id_repuesto,
                        repuesto.cantidad_usada,
                        req.session.id_usuario,
                        `OT-${id}`,
                        `Orden de trabajo #${id}`,
                        `Repuestos utilizados en reparación - Orden: ${id}`
            ]);
                }
            }
            
            const [orden] = await connection.query(`SELECT tipo_orden, id_orden_referencia FROM ordenes_trabajo WHERE id_orden = ?`, [id]);
            if (orden[0]?.tipo_orden === 'taller' && orden[0]?.id_orden_referencia) {
                await connection.query(`
                    UPDATE recepcion_equipos 
                    SET estado_reparacion = 'Reparado' 
                    WHERE id_recepcion = ?
                `, [orden[0].id_orden_referencia]);
            }
        }
        
        await connection.query(`
            UPDATE ordenes_trabajo 
            SET estado = ?, 
                fecha_cierre = ?, 
                trabajo_realizado = ?
            WHERE id_orden = ? AND tecnico_asignado = ?
        `, [estado, fecha_cierre, trabajo_realizado, id, req.session.id_usuario]);
        
        await connection.commit();
        
        req.flash('success', `✅ Orden ${estado === 'Completado' ? 'completada' : 'actualizada'} correctamente`);
        res.redirect('/ordenes/taller');
    } catch (error) {
        await connection.rollback();
        console.error("Error:", error);
        req.flash('error', 'Error al actualizar la orden: ' + error.message);
        res.redirect(`/ordenes/${id}`);
    } finally {
        connection.release();
    }
});


// ============================================
// IMPRIMIR ORDEN DE TRABAJO COMPLETADA
// ============================================
app.get('/ordenes/:id/imprimir', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    const { id } = req.params;
    
    try {
        // Obtener datos completos de la orden
        const [ordenes] = await db.query(`
            SELECT ot.*, 
                   r.id_recepcion,
                   r.falla_reportada,
                   r.quien_entrega,
                   r.accesorios,
                   r.fecha_ingreso,
                   e.id_equipo,
                   e.codigo_informatico,
                   e.marca_modelo,
                   e.serie,
                   e.tipo_equipo,
                   e.codigo_inventario,
                   c.nombre_completo AS colaborador_nombre,
                   c.cargo,
                   c.extension_telefonica,
                   d.nombre_dependencia,
                   u.nombre AS tecnico_nombre
            FROM ordenes_trabajo ot
            LEFT JOIN recepcion_equipos r ON ot.id_orden_referencia = r.id_recepcion
            LEFT JOIN equipos e ON ot.id_equipo = e.id_equipo
            LEFT JOIN colaboradores c ON ot.id_colaborador = c.id_colaborador
            LEFT JOIN dependencias d ON c.id_dependencia = d.id_dependencia
            LEFT JOIN usuarios u ON ot.tecnico_asignado = u.id_usuarios
            WHERE ot.id_orden = ? AND ot.tecnico_asignado = ?
        `, [id, req.session.id_usuario]);
        
        if (ordenes.length === 0) {
            req.flash('error', 'Orden no encontrada o no autorizada');
            return res.redirect('/ordenes/taller');
        }
        
        const orden = ordenes[0];
        
        // Obtener repuestos utilizados en la orden
        const [repuestosUsados] = await db.query(`
            SELECT orp.*, r.nombre, r.descripcion, r.marca
            FROM ordenes_repuestos orp
            JOIN repuestos r ON orp.id_repuesto = r.id_repuestos
            WHERE orp.id_orden = ?
            ORDER BY orp.id_orden_repuesto DESC
        `, [id]);
        
        res.render('imprimir_orden_trabajo', {
            orden: orden,
            repuestosUsados: repuestosUsados
        });
        
    } catch (error) {
        console.error("Error al imprimir orden:", error);
        req.flash('error', 'Error al generar la orden de impresión');
        res.redirect('/ordenes/taller');
    }
});



// ============================================
// ÓRDENES FUERA DEL TALLER / REMOTAS (similares)
// ============================================

// Formulario para orden fuera del taller o remota
app.get('/ordenes/fuera/nueva', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    try {
        const [equipos] = await db.query(`
            SELECT e.*, c.nombre_completo, c.cargo, d.nombre_dependencia
            FROM equipos e
            LEFT JOIN colaboradores c ON e.id_colaborador = c.id_colaborador
            LEFT JOIN dependencias d ON c.id_dependencia = d.id_dependencia
            ORDER BY e.codigo_informatico ASC
        `);
        
        const [tecnicos] = await db.query(`SELECT id_usuarios, nombre FROM usuarios ORDER BY nombre`);
        
        res.render('orden_fuera_nueva', {
            nombre: req.session.nombreReal,
            rol: req.session.rol,
            equipos: equipos,
            tecnicos: tecnicos,
            tipo: req.query.tipo || 'fuera_taller', // fuera_taller o remota
            pagina: 'ordenes_fuera'
        });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Error al cargar formulario');
        res.redirect('/dashboard');
    }
});

// Guardar orden fuera del taller o remota
app.post('/ordenes/fuera/guardar', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    const { tipo_orden, id_equipo, tecnico_asignado, fecha_apertura, trabajo_realizado, observaciones } = req.body;
    
    try {
        // Obtener datos del equipo
        const [equipo] = await db.query(`SELECT id_colaborador FROM equipos WHERE id_equipo = ?`, [id_equipo]);
        
        const [lastOrder] = await db.query(`SELECT numero_orden FROM ordenes_trabajo ORDER BY id_orden DESC LIMIT 1`);
        let newNumber = 1;
        if (lastOrder.length > 0) {
            const lastNum = parseInt(lastOrder[0].numero_orden.split('-')[1]);
            newNumber = lastNum + 1;
        }
        const numero_orden = `OT-${newNumber.toString().padStart(5, '0')}`;
        
        await db.query(`
            INSERT INTO ordenes_trabajo 
            (numero_orden, tipo_orden, id_equipo, id_colaborador, tecnico_asignado, 
             fecha_apertura, trabajo_realizado, observaciones, estado, id_usuario_registro) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Completado', ?)
        `, [
            numero_orden, tipo_orden, id_equipo, equipo[0]?.id_colaborador,
            tecnico_asignado, fecha_apertura, trabajo_realizado, observaciones, req.session.id_usuario
        ]);
        
        req.flash('success', `✅ Orden ${numero_orden} registrada exitosamente`);
        res.redirect(`/ordenes/${tipo_orden === 'fuera_taller' ? 'fuera' : 'remota'}`);
    } catch (error) {
        console.error(error);
        req.flash('error', 'Error al registrar la orden');
        res.redirect(`/ordenes/${req.body.tipo_orden}/nueva`);
    }
});

// ============================================
// ÓRDENES DE MANTENIMIENTO (Múltiples equipos)
// ============================================

app.get('/ordenes/mantenimiento/nueva', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    try {
        const [equipos] = await db.query(`
            SELECT e.*, c.nombre_completo, d.nombre_dependencia
            FROM equipos e
            LEFT JOIN colaboradores c ON e.id_colaborador = c.id_colaborador
            LEFT JOIN dependencias d ON c.id_dependencia = d.id_dependencia
            ORDER BY e.codigo_informatico ASC
        `);
        
        const [tecnicos] = await db.query(`SELECT id_usuarios, nombre FROM usuarios ORDER BY nombre`);
        
        res.render('orden_mantenimiento_nueva', {
            nombre: req.session.nombreReal,
            rol: req.session.rol,
            equipos: equipos,
            tecnicos: tecnicos,
            pagina: 'ordenes_mantenimiento'
        });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Error al cargar formulario');
        res.redirect('/dashboard');
    }
});

app.post('/ordenes/mantenimiento/guardar', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    const { equipos, tecnico_asignado, fecha_apertura, trabajo_realizado, observaciones } = req.body;
    const listaEquipos = Array.isArray(equipos) ? equipos : [equipos];
    
    try {
        const [lastOrder] = await db.query(`SELECT numero_orden FROM ordenes_trabajo ORDER BY id_orden DESC LIMIT 1`);
        let newNumber = 1;
        if (lastOrder.length > 0) {
            const lastNum = parseInt(lastOrder[0].numero_orden.split('-')[1]);
            newNumber = lastNum + 1;
        }
        const numero_orden = `OT-${newNumber.toString().padStart(5, '0')}`;
        
        // Insertar orden principal
        const [result] = await db.query(`
            INSERT INTO ordenes_trabajo 
            (numero_orden, tipo_orden, tecnico_asignado, fecha_apertura, trabajo_realizado, observaciones, estado, id_usuario_registro) 
            VALUES (?, 'mantenimiento', ?, ?, ?, ?, 'Completado', ?)
        `, [numero_orden, tecnico_asignado, fecha_apertura, trabajo_realizado, observaciones, req.session.id_usuario]);
        
        const id_orden = result.insertId;
        
        // Insertar equipos asociados
        for (const id_equipo of listaEquipos) {
            await db.query(`
                INSERT INTO ordenes_mantenimiento_equipos (id_orden, id_equipo, trabajo_realizado) 
                VALUES (?, ?, ?)
            `, [id_orden, id_equipo, trabajo_realizado]);
        }
        
        req.flash('success', `✅ Orden de mantenimiento ${numero_orden} registrada con ${listaEquipos.length} equipo(s)`);
        res.redirect('/ordenes/mantenimiento');
    } catch (error) {
        console.error(error);
        req.flash('error', 'Error al registrar la orden');
        res.redirect('/ordenes/mantenimiento/nueva');
    }
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

    const { 
        id_tipo, id_marca, id_modelo, serie, id_colaborador, 
        codigo_inventario, estado,
        // Especificaciones técnicas
        procesador, velocidad_procesador, memoria_ram, tipo_memoria, slots_memoria,
        disco_duro, tipo_disco, capacidad_disco, tarjeta_grafica, vram,
        sistema_operativo, arquitectura_os, version_os, office_version, antivirus,
        fecha_instalacion_os, observaciones_tecnicas
    } = req.body;

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

        // Generar código informático
        let num = (tipo[0].ultimo_numero || 0) + 1;
        let codInf = `${tipo[0].prefijo}${num}`;
        
        let intentos = 0;
        let codigoExiste = true;
        
        while (codigoExiste && intentos < 100) {
            const [existe] = await db.query(
                'SELECT COUNT(*) as total FROM equipos WHERE codigo_informatico = ?',
                [codInf]
            );
            
            if (existe[0].total > 0) {
                num++;
                codInf = `${tipo[0].prefijo}${num}`;
                intentos++;
            } else {
                codigoExiste = false;
            }
        }

        const marcaModelo = `${marca[0]?.nombre_marca || 'GENERICA'} ${modelo[0]?.nombre_modelo || 'S/M'}`.toUpperCase();
        const codInv = codigo_inventario ? codigo_inventario.toUpperCase().trim() : codInf;
        const estadoFinal = estado || 'Operativo';

        // Insertar equipo
        const [result] = await db.query(`
            INSERT INTO equipos 
            (codigo_inventario, codigo_informatico, tipo_equipo, marca_modelo, serie, id_colaborador, area_departamento, estado, fecha_registro) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [codInv, codInf, tipo[0].nombre_tipo.toUpperCase(), marcaModelo, serie.toUpperCase().trim(), id_colaborador, oficinaFinal, estadoFinal]);

        const id_equipo = result.insertId;

        // Insertar especificaciones solo si es Desktop o Laptop
        const nombreTipo = tipo[0].nombre_tipo.toLowerCase();
        if (nombreTipo === 'desktop' || nombreTipo === 'laptop') {
            await db.query(`
                INSERT INTO especificaciones_equipos 
                (id_equipo, procesador, velocidad_procesador, memoria_ram, tipo_memoria, slots_memoria,
                 disco_duro, tipo_disco, capacidad_disco, tarjeta_grafica, vram,
                 sistema_operativo, arquitectura_os, version_os, office_version, antivirus,
                 fecha_instalacion_os, observaciones_tecnicas) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id_equipo, procesador, velocidad_procesador, memoria_ram, tipo_memoria, slots_memoria,
                disco_duro, tipo_disco, capacidad_disco, tarjeta_grafica, vram,
                sistema_operativo, arquitectura_os, version_os, office_version, antivirus,
                fecha_instalacion_os, observaciones_tecnicas
            ]);
        }

        await db.query('UPDATE tipos_equipo SET ultimo_numero = ? WHERE id_tipo = ?', [num, id_tipo]);

        req.flash('success', `✅ Equipo registrado. Código: ${codInf}`);
        res.redirect('/inventario/equipos');

    } catch (error) {
        console.error("Error en registro:", error.message);
        req.flash('error', 'Error: ' + error.message);
        res.redirect('/inventario/equipos');
    }
});



// Editar los datos de un equipo
app.post('/inventario/equipos/actualizar', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');

    const { 
        id_equipo, serie, estado, id_colaborador,
        // Especificaciones
        procesador, velocidad_procesador, memoria_ram, tipo_memoria, slots_memoria,
        disco_duro, tipo_disco, capacidad_disco, tarjeta_grafica, vram,
        sistema_operativo, arquitectura_os, version_os, office_version, antivirus,
        fecha_instalacion_os, observaciones_tecnicas
    } = req.body;

    try {
        const [datosCol] = await db.query(`
            SELECT d.nombre_dependencia 
            FROM colaboradores c
            JOIN dependencias d ON c.id_dependencia = d.id_dependencia
            WHERE c.id_colaborador = ?
        `, [id_colaborador]);

        const nuevaOficina = datosCol[0].nombre_dependencia.toUpperCase();

        // Actualizar equipo
        await db.query(`
            UPDATE equipos 
            SET serie = ?, estado = ?, id_colaborador = ?, area_departamento = ?
            WHERE id_equipo = ?
        `, [serie.toUpperCase(), estado, id_colaborador, nuevaOficina, id_equipo]);
        
        // 🔥 Actualizar o insertar especificaciones
        await db.query(`
            INSERT INTO especificaciones_equipos 
            (id_equipo, procesador, velocidad_procesador, memoria_ram, tipo_memoria, slots_memoria,
             disco_duro, tipo_disco, capacidad_disco, tarjeta_grafica, vram,
             sistema_operativo, arquitectura_os, version_os, office_version, antivirus,
             fecha_instalacion_os, observaciones_tecnicas) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            procesador = VALUES(procesador),
            velocidad_procesador = VALUES(velocidad_procesador),
            memoria_ram = VALUES(memoria_ram),
            tipo_memoria = VALUES(tipo_memoria),
            slots_memoria = VALUES(slots_memoria),
            disco_duro = VALUES(disco_duro),
            tipo_disco = VALUES(tipo_disco),
            capacidad_disco = VALUES(capacidad_disco),
            tarjeta_grafica = VALUES(tarjeta_grafica),
            vram = VALUES(vram),
            sistema_operativo = VALUES(sistema_operativo),
            arquitectura_os = VALUES(arquitectura_os),
            version_os = VALUES(version_os),
            office_version = VALUES(office_version),
            antivirus = VALUES(antivirus),
            fecha_instalacion_os = VALUES(fecha_instalacion_os),
            observaciones_tecnicas = VALUES(observaciones_tecnicas)
        `, [
            id_equipo, 
            procesador || null, velocidad_procesador || null, memoria_ram || null, tipo_memoria || null, slots_memoria || null,
            disco_duro || null, tipo_disco || null, capacidad_disco || null, tarjeta_grafica || null, vram || null,
            sistema_operativo || null, arquitectura_os || null, version_os || null, office_version || null, antivirus || null,
            fecha_instalacion_os || null, observaciones_tecnicas || null
        ]);
        
        req.flash('success', '✅ Equipo actualizado correctamente');
        res.redirect('/inventario/equipos');
        
    } catch (error) {
        console.error(error);
        req.flash('error', 'Error al actualizar: ' + error.message);
        res.redirect('/inventario/equipos');
    }
});


// API para obtener especificaciones de un equipo
app.get('/api/equipo/:id/especificaciones', async (req, res) => {
    if (!req.session.loggedin) return res.status(401).json({ error: 'No autorizado' });
    
    try {
        const [especificaciones] = await db.query(`
            SELECT * FROM especificaciones_equipos WHERE id_equipo = ?
        `, [req.params.id]);
        
        res.json(especificaciones[0] || {});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al cargar especificaciones' });
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


// API para obtener los datos de un solo colaborador 
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
        // 1. Insertar en recepcion_equipos
        const [result] = await db.query(`
            INSERT INTO recepcion_equipos 
            (id_equipo, fecha_ingreso, falla_reportada, accesorios, quien_entrega, estado_reparacion, tecnico_asignado, notas_adicionales) 
            VALUES (?, NOW(), ?, ?, ?, 'Pendiente', ?, ?)
        `, [id_equipo, falla_reportada, accesorios || null, quien_entrega, tecnico_asignado, null]);

        const id_recepcion = result.insertId;

        // 2. 🔥 NUEVO: CREAR ORDEN DE TRABAJO para el técnico asignado
        // Obtener el colaborador asignado al equipo
        const [equipo] = await db.query(`SELECT id_colaborador FROM equipos WHERE id_equipo = ?`, [id_equipo]);
        
        // Generar número de orden consecutivo
        const [lastOrder] = await db.query(`SELECT numero_orden FROM ordenes_trabajo ORDER BY id_orden DESC LIMIT 1`);
        let newNumber = 1;
        if (lastOrder.length > 0) {
            const lastNum = parseInt(lastOrder[0].numero_orden.split('-')[1]);
            newNumber = lastNum + 1;
        }
        const numero_orden = `OT-${newNumber.toString().padStart(5, '0')}`;
        
        await db.query(`
            INSERT INTO ordenes_trabajo 
            (numero_orden, tipo_orden, id_orden_referencia, id_equipo, id_colaborador, 
             tecnico_asignado, fecha_apertura, estado, id_usuario_registro) 
            VALUES (?, 'taller', ?, ?, ?, ?, NOW(), 'Pendiente', ?)
        `, [
            numero_orden, 
            id_recepcion, 
            id_equipo, 
            equipo[0]?.id_colaborador || null,
            tecnico_asignado, 
            req.session.id_usuario
        ]);

        req.flash('success', `✅ Orden de servicio #${id_recepcion} y orden de trabajo ${numero_orden} creada`);
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


// Marcar equipo como entregado con registro de entrega
app.post('/taller/recepcion/entregar', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');

    const { 
        id_recepcion, 
        fecha_entrega, 
        tecnico_entrega, 
        persona_retira, 
        documento_retira, 
        telefono_retira, 
        observaciones_entrega,
        imprimir_seguridad 
    } = req.body;

    try {
        // Actualizar estado en recepcion_equipos
        await db.query(`
            UPDATE recepcion_equipos 
            SET estado_reparacion = 'Entregado' 
            WHERE id_recepcion = ?
        `, [id_recepcion]);

        // Registrar entrega en tabla de entregas
        const [result] = await db.query(`
            INSERT INTO entregas_equipos 
            (id_recepcion, fecha_entrega, tecnico_entrega, persona_retira, 
             documento_retira, telefono_retira, observaciones, usuario_registro) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [id_recepcion, fecha_entrega, tecnico_entrega, persona_retira, 
            documento_retira || null, telefono_retira || null, observaciones_entrega || null, req.session.id_usuario]);

        const id_entrega = result.insertId;

        req.flash('success', '✅ Equipo entregado correctamente');

        // Redirigir a impresión según la opción
        if (imprimir_seguridad === '1') {
            res.redirect(`/taller/recepcion/imprimir-entrega/${id_entrega}?tipo=seguridad`);
        } else {
            res.redirect(`/taller/recepcion/imprimir-entrega/${id_entrega}?tipo=taller`);
        }

    } catch (error) {
        console.error("Error al entregar equipo:", error);
        req.flash('error', 'Error al entregar el equipo: ' + error.message);
        res.redirect('/taller/recepcion');
    }
});


// Imprimir comprobante de entrega
app.get('/taller/recepcion/imprimir-entrega/:id_entrega', async (req, res) => {
    if (!req.session.loggedin) return res.redirect('/');
    
    const { id_entrega } = req.params;
    const { tipo } = req.query; // 'taller' o 'seguridad'
    
    try {
        const [entregas] = await db.query(`
            SELECT e.*, r.id_recepcion, r.id_equipo
            FROM entregas_equipos e
            JOIN recepcion_equipos r ON e.id_recepcion = r.id_recepcion
            WHERE e.id_entrega = ?
        `, [id_entrega]);
        
        if (entregas.length === 0) {
            req.flash('error', 'Registro de entrega no encontrado');
            return res.redirect('/taller/recepcion');
        }
        
        const entrega = entregas[0];
        
        const [equipos] = await db.query(`
            SELECT e.* 
            FROM equipos e
            WHERE e.id_equipo = ?
        `, [entrega.id_equipo]);
        
        const equipo = equipos[0];
        
        res.render('imprimir_entrega', {
            entrega: entrega,
            equipo: equipo,
            recepcion: { id_recepcion: entrega.id_recepcion },
            tipo: tipo || 'taller'
        });
        
    } catch (error) {
        console.error("Error:", error);
        req.flash('error', 'Error al generar comprobante');
        res.redirect('/taller/recepcion');
    }
});



// Código para arrancar el Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en: http://localhost:${PORT}`);
});