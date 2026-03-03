// const express = require("express");
// const admin = require("firebase-admin");
// const cors = require("cors");

// const app = express();
// app.use(cors());
// app.use(express.json());

// // 🔹 Conectar Firebase con clave local
// admin.initializeApp({
//   credential: admin.credential.cert(require("./serviceAccountKey.json"))
// });

// const db = admin.firestore();

// // =============================
// // 🔐 VALIDAR LICENCIA
// // =============================
// app.post("/validate", async (req, res) => {
//   const { license_key, machine_id } = req.body;

//   if (!license_key || !machine_id) {
//     return res.status(400).json({ status: "missing_data" });
//   }

//   try {
//     const docRef = db.collection("licenses").doc(license_key);
//     const doc = await docRef.get();

//     // ❌ No existe
//     if (!doc.exists) {
//       return res.json({ status: "invalid" });
//     }

//     const data = doc.data();

//     // 🚫 Desactivada manualmente
//     if (data.status !== "active") {
//       return res.json({ status: "blocked" });
//     }

//     // ⏰ Verificar expiración
//     const now = new Date();
//     const expires = data.expires_at.toDate();

//     if (now > expires) {
//       return res.json({ status: "expired" });
//     }

//     // 🔐 Si no tiene machine_id lo asignamos
//     if (!data.machine_id) {
//       await docRef.update({ machine_id });
//     }

//     // 🚨 Si ya está ligada a otra máquina
//     if (data.machine_id && data.machine_id !== machine_id) {
//       return res.json({ status: "device_mismatch" });
//     }

//     // ✅ Todo correcto
//     return res.json({ status: "ok" });

//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({ status: "error" });
//   }
// });

// // =============================
// // 🚀 INICIAR SERVIDOR
// // =============================
// const PORT = process.env.PORT || 3000;

// app.listen(PORT, () => {
//   console.log("Server running on port " + PORT);
// });

const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 🔹 CONFIGURACIÓN DE FIREBASE (Híbrida)
// ==========================================
// Intentamos cargar desde la variable de entorno (Render), 
// si no existe, usamos el archivo local (Tu PC).
let serviceAccount;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log("✅ Firebase cargado desde variables de entorno.");
  } else {
    serviceAccount = require("./serviceAccountKey.json");
    console.log("🏠 Firebase cargado desde archivo local.");
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} catch (error) {
  console.error("🔴 Error crítico al iniciar Firebase:", error.message);
  process.exit(1); // Detener el servidor si no hay credenciales
}

const db = admin.firestore();

// ==========================================
// 🔐 VALIDAR LICENCIA
// ==========================================
app.post("/validate", async (req, res) => {
  const { license_key, machine_id } = req.body;

  if (!license_key || !machine_id) {
    return res.status(400).json({ status: "missing_data" });
  }

  try {
    const docRef = db.collection("licenses").doc(license_key);
    const doc = await docRef.get();

    // ❌ No existe la licencia
    if (!doc.exists) {
      return res.json({ status: "invalid" });
    }

    const data = doc.data();

    // 🚫 Estado de la licencia (debe ser 'active')
    if (data.status !== "active") {
      return res.json({ status: "blocked" });
    }

    // ⏰ Verificar expiración (Firestore Timestamp a JS Date)
    if (data.expires_at) {
      const now = new Date();
      const expires = data.expires_at.toDate();

      if (now > expires) {
        return res.json({ status: "expired" });
      }
    }

    // 🔐 Vinculación de Hardware ID
    if (!data.machine_id) {
      // Primera vez: vinculamos la licencia a esta PC
      await docRef.update({ machine_id });
      console.log(`🆕 Licencia ${license_key} vinculada a ID: ${machine_id}`);
    } else if (data.machine_id !== machine_id) {
      // Intento de uso en una segunda PC
      return res.json({ status: "device_mismatch" });
    }

    // ✅ Licencia perfecta
    return res.json({ status: "ok" });

  } catch (error) {
    console.error("🔴 Error en Firestore:", error);
    return res.status(500).json({ status: "error" });
  }
});

// ==========================================
// 🚀 INICIAR SERVIDOR (Configuración Render)
// ==========================================
// Usamos 0.0.0.0 para que el servicio sea accesible externamente en la red de Render
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor validando en puerto ${PORT}`);
});