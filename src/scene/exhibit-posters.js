function drawProcess(context, width, height, work, textures, t) {
  const pioneer = work.process === "pioneer", pad = width * .055;
  context.fillStyle = "#f4efe4"; context.fillRect(0, 0, width, height);
  context.fillStyle = pioneer ? "#8b5c42" : "#587364"; context.fillRect(pad, height*.075, 45, 5);
  context.fillStyle = "#41483d"; context.font = "600 " + width*.031 + "px Arial";
  context.fillText(pioneer ? "PIONEER OF PREHISTORY" : "ESUAP", pad, height*.14);
  context.font = width*.038 + "px Georgia";
  context.fillText(t(pioneer ? "copy.four-layers-one-character" : "copy.from-wireframe-to-interface"), pad, height*.215, width-pad*2);
  context.strokeStyle = "#d2cbbb"; context.lineWidth = 2;
  context.beginPath(); context.moveTo(width*.5,height*.3); context.lineTo(width*.5,height*.83); context.stroke();
  context.fillStyle = "#414a3d"; context.font = width*.023 + "px Arial";
  context.fillText("01 / " + t(pioneer ? "copy.original-layers" : "copy.wireframes"), pad, height*.30);
  context.fillText("02 / " + t(pioneer ? "copy.assembled-pose" : "copy.working-frontend"), width*.55, height*.30);
  function contain(image, x,y,w,h, crop=null) {
    const [sx,sy,sw,sh] = crop || [0,0,image.width,image.height];
    const scale = Math.min(w/sw,h/sh);
    context.drawImage(image,sx,sy,sw,sh,x+(w-sw*scale)/2,y+(h-sh*scale)/2,sw*scale,sh*scale);
  }
  if (pioneer) {
    context.imageSmoothingEnabled = false;
    const names = ["copy.tail-layer","copy.body-layer","copy.arm-layer","copy.leg-layer"];
    work.sprites.forEach((src,index) => {
      const x=pad+(index%2)*width*.205, y=height*.35+Math.floor(index/2)*height*.235, side=height*.18;
      context.fillStyle="#e5dfd0"; context.fillRect(x,y,width*.18,side);
      contain(textures.get(src).image,x,y,width*.18,side);
      context.fillStyle="#414a3d"; context.font=width*.019+"px Arial";
      context.fillText(t(names[index]),x,y+side+height*.035,width*.18);
    });
    const side=Math.min(width*.34,height*.48), x=width*.58, y=height*.36;
    context.fillStyle="#e5dfd0"; context.fillRect(x,y,side,side);
    work.sprites.forEach(src=>contain(textures.get(src).image,x,y,side,side));
  } else {
    // Only the original wireframe area: the reference collage on the source board stays outside the crop.
    const wireframe = textures.get(work.sprites[0]).image;
    // The crop is recorded in the 1980 × 1090 original, even when a smaller WebP is loaded.
    const cropScaleX = wireframe.width / 1980, cropScaleY = wireframe.height / 1090;
    contain(wireframe,pad,height*.34,width*.39,height*.50,[363*cropScaleX,353*cropScaleY,607*cropScaleX,670*cropScaleY]);
    contain(textures.get(work.sprites[1]).image,width*.55,height*.34,width*.39,height*.50);
  }
  context.fillStyle="#414a3d"; context.font=width*.021+"px Arial";
  context.fillText(t(pioneer ? "copy.original-drawing-layers-open-the-walk-cycle" : "copy.my-wireframes-frontend-team-project"),pad,height*.94,width-pad*2);
}

function drawKinbot(context, width, height, work, textures, t) {
  // KinBot's Aurora palette, adapted as a static printed contribution card.
  context.fillStyle = "#100c1c";
  context.fillRect(0, 0, width, height);
  for (const [x, y, radius, color] of [[.05, .15, .75, "#7138b34d"], [.97, .8, .7, "#d64b8a38"]]) {
    const glow = context.createRadialGradient(width * x, height * y, 0, width * x, height * y, width * radius);
    glow.addColorStop(0, color); glow.addColorStop(1, "#100c1c00");
    context.fillStyle = glow; context.fillRect(0, 0, width, height);
  }
  const pad = width * .075;
  const aurora = context.createLinearGradient(pad, 0, width * .8, height);
  aurora.addColorStop(0, "#b882f5"); aurora.addColorStop(.55, "#ed78b4"); aurora.addColorStop(1, "#ffb59c");
  context.fillStyle = aurora; context.fillRect(0, 0, width, 5);
  const logoSize = height * .13;
  context.drawImage(textures.get(work.sprites[0]).image, pad, height * .09, logoSize, logoSize);
  context.fillStyle = "#f6efff"; context.font = "700 " + height * .073 + "px Arial";
  context.fillText("Kinbot", pad + logoSize + 18, height * .185);
  context.fillStyle = "#ffffff0b"; context.strokeStyle = "#bd8fe33d"; context.lineWidth = 2;
  context.beginPath(); context.roundRect(width * .72, height * .105, width * .205, height * .09, height * .045);
  context.fill(); context.stroke();
  context.fillStyle = "#dbbfef"; context.font = "500 " + height * .035 + "px Arial";
  context.textAlign = "center"; context.fillText("EN → DE", width * .8225, height * .165); context.textAlign = "left";
  context.fillStyle = aurora; context.font = "700 " + height * .22 + "px Arial";
  context.fillText("Hallo.", pad, height * .54);
  context.fillStyle = "#c7bad6"; context.font = height * .047 + "px Arial";
  context.fillText(t("copy.german-localisation"), pad, height * .64, width - 2 * pad);
  context.strokeStyle = "#bda4d32b"; context.beginPath();
  context.moveTo(pad, height * .73); context.lineTo(width - pad, height * .73); context.stroke();
  context.fillStyle = "#f4eaff"; context.font = "600 " + height * .05 + "px Arial";
  context.fillText(t("copy.1-486"), pad, height * .835);
  context.fillStyle = "#b5a4c6"; context.font = height * .034 + "px Arial";
  context.fillText(t("copy.strings-translated"), pad, height * .9);
  context.textAlign = "right"; context.fillStyle = "#edacd1";
  context.font = "600 " + height * .045 + "px Arial"; context.fillText("PR #237", width - pad, height * .835);
  context.fillStyle = "#b5a4c6"; context.font = height * .034 + "px Arial";
  context.fillText(t("copy.merged-2"), width - pad, height * .9); context.textAlign = "left";
}

function drawCharacters(context, width, height, work, textures, t) {
  // Sechs originale Unity-Porträts als ruhiges, gemeinsames Character-Sheet.
  context.fillStyle = "#f6f0e4"; context.fillRect(0, 0, width, height);
  const names = ["copy.bear", "copy.hare", "copy.monkey", "copy.rhino", "copy.crocodile", "copy.meerkat"];
  const cellWidth = width / 3, cellHeight = height / 2;
  context.textAlign = "center"; context.fillStyle = "#66563e";
  context.font = "20px Arial";
  work.sprites.forEach(function (src, index) {
    const image = textures.get(src).image;
    const side = Math.min(cellWidth * .84, cellHeight * .82);
    const x = (index % 3) * cellWidth + cellWidth / 2;
    const y = Math.floor(index / 3) * cellHeight;
    context.drawImage(image, x - side / 2, y + cellHeight * .02, side, side);
    context.fillText(t(names[index]).toUpperCase(), x, y + cellHeight * .94);
  });
}

function drawBoard(context, width, height, work, textures, t) {
  // Originale Ansichten und Varianten als Sammlung zeigen; keine neuen Grafiken erfinden.
  context.fillStyle = "#f4f0e7"; context.fillRect(0, 0, width, height);
  context.fillStyle = "#343e37"; context.font = "28px Arial";
  context.fillText(t("copy.pioneer-character-study"), 48, 58);
  context.imageSmoothingEnabled = false;
  work.sprites.forEach(function (src, index) {
    const views = index < 3;
    const count = views ? 3 : 5;
    const slot = (width - 96) / count;
    const side = Math.min(slot * .85, height * (views ? .45 : .16));
    const column = views ? index : index - 3;
    const x = 48 + column * slot + (slot - side) / 2;
    const y = views ? height * .19 : height * .77;
    context.drawImage(textures.get(src).image, x, y, side, side);
  });
  context.font = "22px Arial";
  context.fillText(t("copy.front-side-back"), 48, height * .7);
}

function drawEffects(context, width, height, work, textures, t) {
  context.fillStyle = "#243646"; context.fillRect(0, 0, width, height);
  context.fillStyle = "#fcf8ee";
  const pad = 75;
  context.font = Math.min(38, height * .065) + "px Arial";
  context.fillText(t("copy.dilibad-skill-effects"), pad, height * .15, width - 2 * pad);
  const columns = 4, rows = Math.ceil(work.sprites.length / columns);
  const cell = (width - pad * 2) / columns, rowHeight = height * .43 / rows;
  const icon = Math.min(cell * .8, rowHeight * .85);
  context.imageSmoothingEnabled = false;
  work.sprites.forEach((src, index) => {
    const x = pad + (index % columns) * cell + (cell - icon) / 2;
    const y = height * .25 + Math.floor(index / columns) * rowHeight;
    context.drawImage(textures.get(src).image, x, y, icon, icon);
  });
  context.font = Math.min(39, height * .06) + "px Arial";
  ["copy.seven-original-effects", "copy.assets-design-team-project"].forEach((line, index) =>
    context.fillText(t(line), pad, height * (.84 + index * .08), width - 2 * pad));
}

const painters = {
  process: drawProcess,
  kinbot: drawKinbot,
  characters: drawCharacters,
  board: drawBoard,
  sprites: drawEffects
};

export function createPosterRenderer({ textures, canvasTexture, t }) {
  return function renderPoster(work, width, height) {
    const resolution = work.kind === "process" ? 2048 : 1024;
    const paint = painters[work.kind] ?? drawEffects;
    return canvasTexture((context, w, h) => paint(context, w, h, work, textures, t),
      resolution, Math.round(resolution * height / width), true);
  };
}
