// Condicionantes y criterios para generar los equipos de Fútbol 7.
// Se descarga desde la pestaña Condicionantes de la web, pero también se puede editar a mano.
//   tipo "separar": no pueden ir en el mismo equipo.
//   tipo "juntar":  deben ir juntos si es posible.
//   a y b son los id de los jugadores en fut7-puntuaciones; nombreA y nombreB son para leerlo
//   mejor (si un id deja de existir, se busca al jugador por su nombre).
//   criterios: cuánto pesa cada cosa al generar los equipos, de 0 a 10.
window.CONDICIONANTES = {
  "condicionantes": [
  ],
  "criterios": { "media": 5, "posiciones": 5, "condicionantes": 5, "atributos": 1 }
};
