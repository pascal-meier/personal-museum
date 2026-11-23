const formerRooms = ["ranworld", "animalsoccer", "dilibad", "game-art", "cargonaut", "web-design", "visual-communication", "photos"];

export function createMuseumNavigation({
  document,
  history,
  location,
  rooms,
  roomsById,
  details,
  aboutSource,
  t,
  getCurrentRoom,
  getPhotoStop,
  getTravelling,
  getNavigate,
  finishWalk,
  sectionEntry,
  onCopyRefreshed
}) {
  const workDialog = document.getElementById("work-dialog");
  const overviewDialog = document.getElementById("overview-dialog");
  const aboutDialog = document.getElementById("about-dialog");
  const signDialog = document.getElementById("sign-dialog");
  const roomSignButton = document.getElementById("open-room-sign");
  const previousButton = document.getElementById("previous-room");
  const labels = document.getElementById("work-labels");
  const heading = document.getElementById("room-heading");
  const workListButtons = new Map();
  const popupStack = [];
  let returning = false;
  let afterReturn = null;

  function openWork(project, button) {
    if (getTravelling() || !details.has(project)) return;
    openPopup({ type: "work", value: project }, button);
  }

  function returnTo(room) {
    return room.id === "lobby" ? t("copy.back-to-the-lobby") : t("copy.back-to-room") + " " + room.name;
  }

  function showSign() {
    const current = rooms[getCurrentRoom()];
    document.getElementById("sign-number").textContent = t("copy.room");
    document.getElementById("sign-title").textContent = current.name;
    document.getElementById("sign-description").textContent = current.intro;
  }

  function showPopup(state) {
    let dialog;
    if (state.type === "work") {
      const article = details.get(state.value).cloneNode(true);
      article.hidden = false;
      article.querySelector("h2").id = "work-title";
      document.getElementById("work-content").replaceChildren(article);
      dialog = workDialog;
      const photoWorks = roomsById.get("photos").works;
      const photoIndex = photoWorks.findIndex(work => work.project === state.value);
      dialog.classList.toggle("is-photo-view", photoIndex >= 0);
      if (photoIndex >= 0) {
        const nav = document.createElement("nav");
        nav.className = "photo-browser";
        nav.setAttribute("aria-label", t("copy.browse-photographs"));
        for (const step of [-1, 1]) {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.photoStep = step;
          button.textContent = step < 0
            ? "← " + t("copy.previous-photograph")
            : t("copy.next-photograph") + " →";
          button.disabled = !photoWorks[photoIndex + step];
          button.addEventListener("click", () => {
            const next = { type: "work", value: photoWorks[photoIndex + step].project };
            popupStack.at(-1).state = next;
            history.replaceState(
              { ...history.state, museumPopups: popupStack.map(popup => popup.state) },
              "",
              "#work/" + next.value
            );
            showPopup(next);
            const focusTarget = workDialog.querySelector(
              '[data-photo-step="' + step + '"]:not(:disabled)'
            ) || workDialog.querySelector(".photo-browser button:not(:disabled)");
            focusTarget?.focus({ preventScroll: true });
          });
          nav.append(button);
          if (step < 0) {
            const count = document.createElement("span");
            count.setAttribute("aria-live", "polite");
            count.textContent = (photoIndex + 1) + " / " + photoWorks.length;
            nav.append(count);
          }
        }
        document.getElementById("work-content").prepend(nav);
      }
    } else if (state.type === "overview") {
      dialog = overviewDialog;
    } else if (state.type === "about") {
      const about = aboutSource.cloneNode(true);
      about.removeAttribute("hidden");
      about.querySelector("[data-return-gallery]").remove();
      document.getElementById("about-content").replaceChildren(about);
      dialog = aboutDialog;
    } else {
      showSign();
      dialog = signDialog;
    }
    dialog.showModal();
    dialog.querySelector(".dialog-scroll").scrollTop = 0;
    if (state.type === "overview") {
      document.getElementById(state.value).scrollIntoView({ block: "start" });
    }
    return dialog;
  }

  function openPopup(state, opener) {
    finishWalk?.();
    const states = popupStack.map(popup => popup.state);
    history.pushState(
      {
        ...history.state,
        museumRoom: rooms[getCurrentRoom()].id,
        museumPopups: [...states, state]
      },
      "",
      state.type === "work" ? "#work/" + state.value : location.hash
    );
    popupStack.push({ state, opener, dialog: showPopup(state) });
  }

  function closePopup(then = null) {
    if (returning || !popupStack.length) return;
    returning = true;
    afterReturn = then;
    history.back();
  }

  function roomFromHash() {
    const hash = location.hash.slice(1);
    const legacy = /^room-(\d+)$/.exec(hash);
    const linkedWork = /^work\/([\w-]+)$/.exec(hash)?.[1];
    const id = linkedWork && details.has(linkedWork)
      ? history.state?.museumRoom || details.get(linkedWork).dataset.projectRoom
      : legacy
        ? formerRooms[Number(legacy[1]) - 1]
        : hash;
    const room = roomsById.get(id === "process" ? "graphic-design" : id) ?? roomsById.get("lobby");
    return sectionEntry(room).index;
  }

  function goToRoom(room, animate = true, photo = 0) {
    room = sectionEntry(room);
    const navigate = getNavigate();
    if (!room || returning || popupStack.length || !navigate?.(room.index, animate, true, photo)) return;
    history.pushState({ museumPopups: [], photoStop: getPhotoStop() }, "", "#" + room.id);
  }

  function pauseWorkMedia() {
    workDialog.querySelectorAll("video").forEach(video => video.pause());
  }

  function restorePopups() {
    const linkedWork = /^#work\/([\w-]+)$/.exec(location.hash)?.[1];
    const target = history.state?.museumPopups?.length
      ? history.state.museumPopups
      : linkedWork && details.has(linkedWork)
        ? [{ type: "work", value: linkedWork }]
        : [];
    let shared = 0;
    while (shared < popupStack.length && shared < target.length) {
      const { state } = popupStack[shared];
      if (state.type !== target[shared].type || state.value !== target[shared].value) break;
      shared++;
    }
    let opener;
    while (popupStack.length > shared) {
      const popup = popupStack.pop();
      if (popup.dialog === workDialog) pauseWorkMedia();
      popup.dialog.close();
      opener = popup.opener;
    }
    finishWalk?.();
    const index = roomFromHash();
    const roomPhoto = history.state?.photoStop || 0;
    if (
      index !== getCurrentRoom()
      || (rooms[index].id === "photos" && getPhotoStop() !== roomPhoto)
    ) {
      getNavigate()?.(index, false, true, roomPhoto);
    }
    for (const state of target.slice(shared)) {
      popupStack.push({ state, dialog: showPopup(state) });
    }
    if (target.length === shared) {
      (
        opener
        || document.querySelector("dialog[open] .close-button")
        || heading.querySelector("h1")
      )?.focus({ preventScroll: true });
    }
  }

  function prepare() {
    const roomList = document.getElementById("room-list");
    const workList = document.getElementById("work-list");
    function addToRoomList(room, list) {
      const item = document.createElement("li");
      const listButton = document.createElement("button");
      listButton.type = "button";
      listButton.addEventListener("click", () => closePopup(() => goToRoom(room, false)));
      item.append(listButton);
      list.append(item);
      room.listButton = listButton;
      if (room.children.length) {
        const children = document.createElement("ul");
        item.append(children);
        room.children.forEach(child => addToRoomList(child, children));
      }
    }
    addToRoomList(roomsById.get("lobby"), roomList);
    rooms.forEach(room => {
      room.doorButtons = room.children.map(child => {
        const button = document.createElement("button");
        button.type = "button";
        const arrow = document.createElement("span");
        arrow.textContent = "→";
        arrow.setAttribute("aria-hidden", "true");
        button.append(document.createElement("strong"), arrow);
        button.addEventListener("click", () => goToRoom(child));
        return button;
      });
      const wrapper = document.createElement("div");
      wrapper.hidden = true;
      room.labels = wrapper;
      room.works.forEach(work => {
        if (work.hideLabel) {
          work.label = null;
          return;
        }
        const button = document.createElement("button");
        button.type = "button";
        button.className = "work-label";
        button.hidden = work.companion;
        const medium = document.createElement("span");
        medium.className = "work-medium";
        const caption = document.createElement("span");
        caption.className = "work-role";
        button.append(document.createElement("strong"), medium, caption);
        button.addEventListener("click", () => openWork(work.project, button));
        wrapper.append(button);
        work.label = button;
      });
      labels.append(wrapper);
    });

    const catalogueGroups = [
      ["animalsoccer", "copy.animalsoccer"], ["dilibad", "copy.dilibad"],
      ["research", "copy.research-prototype"], ["esuap", "copy.esuap"],
      ["studies", "copy.studies-game-art"],
      ["nature-photos", "copy.nature-animal-photography"],
      ["details-photos", "copy.nature-details-still-life"],
      ["portrait-photos", "copy.portrait-studies"],
      ["contribution", "copy.open-source-contribution"],
      ["web", "copy.web-projects"], ["archive", "copy.earlier-projects-2022"]
    ];
    for (const [group, title] of catalogueGroups) {
      const section = document.createElement("section");
      section.className = "catalogue-group";
      const catalogueHeading = document.createElement("h4");
      catalogueHeading.dataset.catalogueTitle = title;
      section.append(catalogueHeading);
      const entries = group.endsWith("-photos")
        ? roomsById.get("photos").works.map(work => [work.project, details.get(work.project)])
        : details;
      for (const [project, article] of entries) {
        if (article.dataset.catalogue !== group) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.addEventListener("click", () => openWork(project, button));
        section.append(button);
        workListButtons.set(project, button);
      }
      workList.append(section);
    }
    refreshCopy();

    document.querySelectorAll("[data-open-overview]").forEach(button => {
      button.addEventListener("click", () =>
        openPopup({ type: "overview", value: button.dataset.openOverview }, button)
      );
      button.disabled = false;
    });
    const aboutButton = document.getElementById("open-about");
    aboutButton.addEventListener("click", () => openPopup({ type: "about" }, aboutButton));
    aboutButton.disabled = false;
    document.querySelectorAll("[data-guide-target]").forEach(button => {
      button.addEventListener("click", () => goToRoom(roomsById.get(button.dataset.guideTarget)));
    });
    previousButton.addEventListener("click", () => {
      const parent = rooms[getCurrentRoom()].parent;
      if (parent) goToRoom(parent);
    });
    roomSignButton.addEventListener("click", () => {
      if (!getTravelling()) openPopup({ type: "sign", value: "room" }, roomSignButton);
    });
    document.querySelector(".brand").addEventListener("click", event => {
      if (!getNavigate() || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      goToRoom(roomsById.get("lobby"), false);
    });
    document.querySelectorAll("dialog").forEach(dialog => {
      const returnInHistory = event => {
        event.preventDefault();
        closePopup();
      };
      dialog.addEventListener("submit", returnInHistory);
      dialog.addEventListener("cancel", returnInHistory);
    });
    window.addEventListener("popstate", () => {
      const then = afterReturn;
      returning = false;
      afterReturn = null;
      restorePopups();
      then?.();
    });
    document.querySelector(".skip-link").addEventListener("click", event => {
      event.preventDefault();
      document.getElementById("main").focus();
    });
    workDialog.addEventListener("keydown", event => {
      if (!workDialog.classList.contains("is-photo-view") || event.altKey || event.ctrlKey || event.metaKey
        || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      workDialog.querySelector(
        '[data-photo-step="' + (event.key === "ArrowLeft" ? -1 : 1) + '"]:not(:disabled)'
      )?.click();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) pauseWorkMedia();
    });
  }

  function refreshCopy() {
    document.querySelectorAll("[data-catalogue-title]").forEach(catalogueHeading => {
      catalogueHeading.textContent = t(catalogueHeading.dataset.catalogueTitle);
    });
    document.querySelector('[data-open-overview="room-list-title"]').textContent =
      document.documentElement.lang === "de" ? "Rundgang" : "Tour";
    rooms.forEach(room => {
      room.listButton.textContent = room.name;
      room.doorButtons.forEach((button, index) => {
        button.firstElementChild.textContent = room.children[index].name;
      });
      room.works.forEach(work => {
        if (!work.label) return;
        const [title, medium, caption] = work.label.children;
        title.textContent = work.source.querySelector(".work-label strong").textContent;
        medium.textContent = work.source.querySelector(".work-medium")?.textContent || t("copy.digital-work");
        title.hidden = room.works.length === 1;
        work.label.setAttribute("aria-label", title.textContent + " — " + medium.textContent);
        caption.textContent = work.source.querySelector(".work-role")?.textContent
          || work.source.querySelector(".work-label > span")?.textContent || "";
      });
    });
    workListButtons.forEach((button, project) => {
      button.textContent = details.get(project).querySelector("h2").textContent + " ↗︎";
    });
    onCopyRefreshed();
  }

  return {
    openWork,
    openPopup,
    closePopup,
    returnTo,
    roomFromHash,
    goToRoom,
    restorePopups,
    prepare,
    refreshCopy,
    hasPopups: () => popupStack.length > 0
  };
}
