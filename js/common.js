function sincronizarPartidoGlobal(userId, equipoId, competicionId, partidoId) {
    // console.log("sincronizar:", userId, equipoId, competicionId, partidoId);
    const refPartido = db.ref(`usuarios/${userId}/equipos/${equipoId}/competiciones/${competicionId}/partidos/${partidoId}`);
    const refGlobal = db.ref(`partidosGlobales/${partidoId}`);
    return db.ref(`usuarios/${userId}/equipos/${equipoId}/nombre`).once('value').then(nombreSnap => {
        return refPartido.once('value').then(snapshot => {
            if (!snapshot.exists()) {
                // console.log("El partido fue eliminado, borrando de global");
                return refGlobal.remove();
            }
            const p = snapshot.val();
            return refGlobal.set(p);
        });
    }).catch(error => {
        console.error('Error al sincronizar partido global:', error);
    });
}
