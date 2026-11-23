// Alte Museumslinks behalten auch nach der neuen Raumfolge ihr Thema.
const formerRooms = [1, 2, 3, 8, 6, 4, 7, 5];
const formerRoom = /^#room-(\d+)$/.exec(location.hash);
const targetRoom = formerRoom && formerRooms[Number(formerRoom[1]) - 1];
const targetHash = targetRoom ? "#room-" + targetRoom : location.hash;
location.replace("./index.html" + location.search + targetHash);
