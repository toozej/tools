(() => {
  "use strict";

  const actionOrder = [
    "create",
    "update",
    "replace",
    "delete",
    "read",
    "forget",
    "no-op",
  ];
  const actionLabels = {
    create: "create",
    update: "update",
    replace: "replace",
    delete: "delete",
    read: "read",
    forget: "forget",
    "no-op": "no change",
  };
  const nodeWidth = 210;
  const nodeHeight = 48;
  const svgNamespace = "http://www.w3.org/2000/svg";

  const state = {
    graph: null,
    nodesByID: new Map(),
    selectedID: null,
    query: "",
    actions: new Set(actionOrder),
    focus: "all",
    viewport: { x: 0, y: 0, width: 1000, height: 650 },
    nodePositions: new Map(),
    resetViewport: true,
    centerSelected: false,
    dragging: null,
    controlsInitialized: false,
  };

  const graphElement = document.querySelector("#graph");
  const graphContent = document.querySelector("#graph-content");
  const treeElement = document.querySelector("#tree");
  const detailsElement = document.querySelector("#details");
  const filtersElement = document.querySelector("#filters");
  const emptyGraphElement = document.querySelector("#empty-graph");
  const planFileElement = document.querySelector("#plan-file");
  const uploadStatusElement = document.querySelector("#upload-status");

  planFileElement.addEventListener("change", uploadPlan);
  load();

  async function load() {
    try {
      const response = await fetch("api/graph", { cache: "no-store" });
      if (response.status === 404) {
        showUploadPrompt();
        return;
      }
      if (!response.ok)
        throw new Error(`Graph request failed (${response.status})`);
      setGraph(await response.json());
    } catch (error) {
      detailsElement.replaceChildren();
      const message = document.createElement("p");
      message.textContent = `Unable to load the plan graph: ${error.message}`;
      detailsElement.append(message);
      console.error(error);
    }
  }

  async function uploadPlan(event) {
    const [file] = event.target.files;
    if (!file) return;

    uploadStatusElement.textContent = `Loading ${file.name}…`;
    try {
      const response = await fetch("api/graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: file,
      });
      if (!response.ok) throw new Error(await response.text());
      setGraph(await response.json());
      uploadStatusElement.textContent = `Loaded ${file.name}`;
    } catch (error) {
      uploadStatusElement.textContent = "Could not load plan";
      showUploadPrompt(error.message);
      console.error(error);
    } finally {
      planFileElement.value = "";
    }
  }

  function setGraph(graph) {
    const controlsWereInitialized = state.controlsInitialized;
    state.graph = graph;
    state.nodesByID = new Map(graph.nodes.map((node) => [node.id, node]));
    state.selectedID = null;
    state.focus = "all";
    state.resetViewport = true;
    state.centerSelected = false;
    setupControls();
    if (controlsWereInitialized) {
      renderSummary();
      renderFilters();
    }
    render();
  }

  function showUploadPrompt(error = "") {
    detailsElement.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "empty-details";
    const eyebrow = document.createElement("p");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "Terraform plan";
    const title = document.createElement("h2");
    title.textContent = "Load a plan to begin";
    const instructions = document.createElement("p");
    instructions.textContent =
      "Create JSON with terraform show -json tfplan, then choose the resulting file above. The plan is redacted and processed only for this request.";
    empty.append(eyebrow, title, instructions);
    if (error) {
      const message = document.createElement("p");
      message.textContent = error;
      empty.append(message);
    }
    detailsElement.append(empty);
  }

  function setupControls() {
    if (state.controlsInitialized) return;
    state.controlsInitialized = true;
    renderSummary();
    renderFilters();
    document.querySelector("#search").addEventListener("input", (event) => {
      state.query = event.target.value.trim().toLowerCase();
      render();
    });
    document.querySelector("#reset-filters").addEventListener("click", () => {
      state.query = "";
      state.actions = new Set(actionOrder);
      document.querySelector("#search").value = "";
      renderFilters();
      render();
    });
    document.querySelectorAll("[data-focus]").forEach((button) => {
      button.addEventListener("click", () => {
        state.focus = button.dataset.focus;
        state.resetViewport = true;
        document
          .querySelectorAll("[data-focus]")
          .forEach((item) =>
            item.classList.toggle("is-active", item === button),
          );
        renderGraph();
      });
    });
    setupPanAndZoom();
    setupKeyboardNavigation();
  }

  function renderSummary() {
    const summary = document.querySelector("#summary");
    summary.replaceChildren();
    addChip(summary, `${state.graph.summary.total} resources`);
    actionOrder.forEach((action) => {
      const count = state.graph.summary.actions[action] || 0;
      if (count)
        addChip(
          summary,
          `${count} ${actionLabels[action]}`,
          `action-${action}`,
        );
    });
    if (state.graph.summary.drifted)
      addChip(summary, `${state.graph.summary.drifted} drifted`, "drift");
  }

  function addChip(parent, text, action = "") {
    const chip = document.createElement("span");
    chip.className = `summary-chip ${action}`;
    chip.textContent = text;
    parent.append(chip);
  }

  function renderFilters() {
    filtersElement.replaceChildren();
    actionOrder.forEach((action) => {
      const label = document.createElement("label");
      label.className = "action-filter";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.actions.has(action);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) state.actions.add(action);
        else state.actions.delete(action);
        render();
      });
      const dot = document.createElement("span");
      dot.className = `status-dot action-${action}`;
      label.append(
        checkbox,
        dot,
        document.createTextNode(actionLabels[action]),
      );
      filtersElement.append(label);
    });
  }

  function render() {
    renderTree();
    renderGraph();
    renderDetails();
  }

  function matchesFilter(node) {
    if (!state.actions.has(node.action)) return false;
    if (!state.query) return true;
    return [
      node.address,
      node.type,
      node.name,
      node.provider,
      node.moduleAddress,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(state.query);
  }

  function filterNodes() {
    return state.graph.nodes.filter(matchesFilter);
  }

  function moduleSegments(address) {
    const parts = address.split(".");
    const segments = [];
    for (
      let index = 0;
      index + 1 < parts.length && parts[index] === "module";
      index += 2
    ) {
      segments.push(`module.${parts[index + 1]}`);
    }
    return segments;
  }

  function renderTree() {
    const nodes = filterNodes();
    document.querySelector("#tree-count").textContent =
      `${nodes.length} of ${state.graph.nodes.length} resources`;
    treeElement.replaceChildren();
    const root = { children: new Map(), nodes: [] };
    nodes.forEach((node) => {
      let branch = root;
      moduleSegments(node.address).forEach((segment) => {
        if (!branch.children.has(segment))
          branch.children.set(segment, { children: new Map(), nodes: [] });
        branch = branch.children.get(segment);
      });
      branch.nodes.push(node);
    });
    renderBranch(root, "root module", treeElement, 0);
  }

  function renderBranch(branch, label, parent, depth) {
    const details = document.createElement("details");
    details.open = depth < 2;
    const summary = document.createElement("summary");
    const count = countBranch(branch);
    summary.append(
      document.createTextNode(label),
      document.createTextNode(" "),
    );
    const small = document.createElement("small");
    small.textContent = `(${count})`;
    summary.append(small);
    details.append(summary);

    const contents = document.createElement("div");
    contents.className = "tree-branch";
    [...branch.children.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([childLabel, child]) => {
        renderBranch(child, childLabel, contents, depth + 1);
      });
    branch.nodes
      .sort((left, right) => left.address.localeCompare(right.address))
      .forEach((node) => {
        contents.append(resourceButton(node));
      });
    details.append(contents);
    parent.append(details);
  }

  function countBranch(branch) {
    let count = branch.nodes.length;
    branch.children.forEach((child) => {
      count += countBranch(child);
    });
    return count;
  }

  function resourceButton(node) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "resource-button";
    if (node.id === state.selectedID) button.classList.add("is-selected");
    button.title = node.address;
    button.addEventListener("click", () => selectNode(node.id));
    const dot = document.createElement("span");
    dot.className = `status-dot action-${node.action}`;
    const label = document.createElement("span");
    label.className = "resource-label";
    label.textContent = shortAddress(node.address);
    button.append(dot, label);
    return button;
  }

  function visibleGraphNodes() {
    const filtered = filterNodes();
    if (!state.selectedID || state.focus === "all") return filtered;

    const allowed = new Set([state.selectedID]);
    let frontier = new Set([state.selectedID]);
    const hops = state.focus === "two" ? 2 : 1;
    for (let hop = 0; hop < hops; hop++) {
      const next = new Set();
      state.graph.edges.forEach((edge) => {
        if (frontier.has(edge.from)) next.add(edge.to);
        if (frontier.has(edge.to)) next.add(edge.from);
      });
      next.forEach((id) => allowed.add(id));
      frontier = next;
    }
    return filtered.filter((node) => allowed.has(node.id));
  }

  function renderGraph() {
    const nodes = visibleGraphNodes();
    const visible = new Set(nodes.map((node) => node.id));
    const edges = state.graph.edges.filter(
      (edge) => visible.has(edge.from) && visible.has(edge.to),
    );
    graphContent.replaceChildren();
    emptyGraphElement.hidden = nodes.length !== 0;
    if (!nodes.length) return;

    const positions = layoutNodes(nodes);
    const dimensions = graphDimensions(positions);
    state.nodePositions = positions;
    setViewport(dimensions, state.resetViewport);
    state.resetViewport = false;
    if (state.centerSelected && state.selectedID) {
      centerViewportOn(state.selectedID);
      state.centerSelected = false;
    }

    edges.forEach((edge) => {
      const source = positions.get(edge.from);
      const target = positions.get(edge.to);
      if (!source || !target) return;
      const line = svg("line", {
        class: "graph-edge",
        x1: source.x + nodeWidth / 2,
        y1: source.y + nodeHeight / 2,
        x2: target.x + nodeWidth / 2,
        y2: target.y + nodeHeight / 2,
      });
      graphContent.append(line);
    });

    nodes.forEach((node) => {
      const position = positions.get(node.id);
      const group = svg("g", {
        class: "graph-node",
        transform: `translate(${position.x},${position.y})`,
        tabindex: "0",
        role: "button",
        "aria-label": node.address,
      });
      if (node.id === state.selectedID) group.classList.add("is-selected");
      group.addEventListener("click", (event) => {
        event.stopPropagation();
        selectNode(node.id);
      });
      group.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectNode(node.id);
        }
      });
      group.append(
        svg("rect", {
          width: nodeWidth,
          height: nodeHeight,
          rx: 8,
          class: `action-${node.action}`,
        }),
      );
      const action = svg("text", { x: 12, y: 17, class: "node-action" });
      action.textContent = actionLabels[node.action];
      const label = svg("text", { x: 12, y: 35 });
      label.textContent = shortAddress(node.address, 29);
      group.append(action, label);
      if (node.drifted) {
        const drift = svg("text", {
          x: nodeWidth - 22,
          y: 19,
          class: "node-drift",
        });
        drift.textContent = "◇";
        group.append(drift);
      }
      graphContent.append(group);
    });
  }

  function layoutNodes(nodes) {
    const positions = new Map();
    const byModule = new Map();
    nodes.forEach((node) => {
      const key = node.moduleAddress || "root";
      if (!byModule.has(key)) byModule.set(key, []);
      byModule.get(key).push(node);
    });
    const modules = [...byModule.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );
    let moduleOffset = 60;
    modules.forEach(([, group]) => {
      group.sort((left, right) => left.address.localeCompare(right.address));
      const rows = Math.ceil(Math.sqrt(group.length));
      const columns = Math.ceil(group.length / rows);
      group.forEach((node, index) => {
        const col = Math.floor(index / rows);
        const row = index % rows;
        positions.set(node.id, {
          x: moduleOffset + col * 235,
          y: 55 + row * 90,
        });
      });
      moduleOffset += columns * 235 + 105;
    });
    return positions;
  }

  function graphDimensions(positions) {
    let maxX = 600;
    let maxY = 450;
    positions.forEach((position) => {
      maxX = Math.max(maxX, position.x + nodeWidth + 65);
      maxY = Math.max(maxY, position.y + nodeHeight + 65);
    });
    return { x: 0, y: 0, width: maxX, height: maxY };
  }

  function setViewport(next, reset) {
    if (reset || !state.viewport.initialized) {
      state.viewport = { ...next, initialized: true };
    }
    graphElement.setAttribute(
      "viewBox",
      `${state.viewport.x} ${state.viewport.y} ${state.viewport.width} ${state.viewport.height}`,
    );
  }

  function selectNode(id, { center = false } = {}) {
    state.selectedID = id;
    state.centerSelected = center;
    graphElement.focus({ preventScroll: true });
    render();
  }

  function renderDetails() {
    detailsElement.replaceChildren();
    const node = state.nodesByID.get(state.selectedID);
    if (!node) {
      const empty = document.createElement("div");
      empty.className = "empty-details";
      const eyebrow = document.createElement("p");
      eyebrow.className = "eyebrow";
      eyebrow.textContent = "Resource inspector";
      const title = document.createElement("h2");
      title.textContent = "Select a resource";
      const instructions = document.createElement("p");
      instructions.textContent =
        "Choose an item in the tree or graph to see its action, dependencies, source location, and value changes.";
      empty.append(eyebrow, title, instructions);
      detailsElement.append(empty);
      return;
    }

    const label = document.createElement("p");
    label.className = "eyebrow";
    label.textContent =
      node.mode === "data" ? "Data source" : "Managed resource";
    const title = document.createElement("h2");
    title.textContent = `${node.type || "resource"}.${node.name || ""}`;
    const badge = document.createElement("span");
    badge.className = `badge action-${node.action}`;
    badge.textContent = actionLabels[node.action];
    const address = document.createElement("p");
    address.className = "address";
    address.textContent = node.address;
    detailsElement.append(label, title, badge);
    if (node.drifted) {
      const drift = document.createElement("span");
      drift.className = "drift-badge";
      drift.textContent = "Drift detected";
      detailsElement.append(drift);
    }
    detailsElement.append(address, metadata(node));

    const detailActions = document.createElement("div");
    detailActions.className = "detail-actions";
    [
      ["one", "Focus 1 hop"],
      ["two", "Focus 2 hops"],
      ["all", "Whole graph"],
    ].forEach(([focus, text]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = text;
      button.addEventListener("click", () => {
        state.focus = focus;
        state.resetViewport = true;
        document
          .querySelectorAll("[data-focus]")
          .forEach((item) =>
            item.classList.toggle("is-active", item.dataset.focus === focus),
          );
        renderGraph();
      });
      detailActions.append(button);
    });
    detailsElement.append(detailActions);

    appendNeighbors(node);
    if (node.changes && node.changes.length) appendChanges(node.changes);
    if (node.before !== undefined || node.after !== undefined) {
      detailsElement.append(
        valueDetails("Sanitized resource values", node.before, node.after),
      );
    } else if (node.values !== undefined) {
      detailsElement.append(valueDetails("Planned values", null, node.values));
    }
    if (node.generatedConfig) {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "Generated import configuration";
      const pre = document.createElement("pre");
      pre.className = "generated";
      pre.textContent = node.generatedConfig;
      details.append(summary, pre);
      detailsElement.append(details);
    }
  }

  function metadata(node) {
    const metadata = document.createElement("dl");
    metadata.className = "metadata";
    const rows = [
      [
        "Actions",
        (node.actions || []).join(" → ") || actionLabels[node.action],
      ],
      ["Provider", node.provider],
      ["Module", node.moduleAddress || "root module"],
      ["Reason", node.actionReason],
      ["Deferred", node.deferredReason],
      ["Previous address", node.previousAddress],
      ["Import ID", node.importID],
      [
        "Source",
        node.source
          ? `${node.source.filename}:${node.source.startLine}–${node.source.endLine}`
          : "not available",
      ],
    ];
    rows.forEach(([name, value]) => {
      if (!value) return;
      const term = document.createElement("dt");
      term.textContent = name;
      const description = document.createElement("dd");
      description.textContent = value;
      metadata.append(term, description);
    });
    return metadata;
  }

  function appendNeighbors(node) {
    const dependencies = node.dependencies || [];
    const dependents = state.graph.edges
      .filter((edge) => edge.from === node.id)
      .map((edge) => edge.to);
    if (!dependencies.length && !dependents.length) return;
    const wrapper = document.createElement("div");
    if (dependencies.length) {
      wrapper.append(neighbors("Depends on", dependencies));
    }
    if (dependents.length) {
      wrapper.append(neighbors("Required by", dependents));
    }
    detailsElement.append(wrapper);
  }

  function neighbors(title, ids) {
    const section = document.createElement("section");
    const heading = document.createElement("p");
    heading.className = "neighbors-title";
    heading.textContent = title;
    const list = document.createElement("div");
    list.className = "neighbors";
    ids.sort().forEach((id) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dependency";
      button.textContent = shortAddress(id, 25);
      button.title = id;
      button.addEventListener("click", () => selectNode(id));
      list.append(button);
    });
    section.append(heading, list);
    return section;
  }

  function appendChanges(changes) {
    const wrapper = document.createElement("section");
    wrapper.className = "changes";
    const title = document.createElement("h3");
    title.textContent = `${changes.length} changed ${changes.length === 1 ? "attribute" : "attributes"}`;
    wrapper.append(title);
    changes.forEach((change) => {
      const changeElement = document.createElement("article");
      changeElement.className = "change";
      const path = document.createElement("h4");
      path.className = "change-path";
      path.textContent = change.path;
      changeElement.append(path, valuePair(change.before, change.after));
      wrapper.append(changeElement);
    });
    detailsElement.append(wrapper);
  }

  function valueDetails(title, before, after) {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = title;
    details.append(summary, valuePair(before, after));
    return details;
  }

  function valuePair(before, after) {
    const pair = document.createElement("div");
    pair.className = "value-pair";
    pair.append(valueBlock("Before", before), valueBlock("After", after));
    return pair;
  }

  function valueBlock(label, value) {
    const wrapper = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = label;
    const pre = document.createElement("pre");
    pre.textContent = printValue(value);
    wrapper.append(title, pre);
    return wrapper;
  }

  function printValue(value) {
    if (value === undefined) return "(not present)";
    if (value === null) return "null";
    if (typeof value === "string") return value;
    return JSON.stringify(value, null, 2);
  }

  function shortAddress(address, limit = 37) {
    if (address.length <= limit) return address;
    return `…${address.slice(-(limit - 1))}`;
  }

  function svg(name, attributes = {}) {
    const element = document.createElementNS(svgNamespace, name);
    Object.entries(attributes).forEach(([key, value]) =>
      element.setAttribute(key, String(value)),
    );
    return element;
  }

  function setupPanAndZoom() {
    graphElement.addEventListener(
      "wheel",
      (event) => {
        if (!state.viewport.initialized) return;
        if (event.cancelable) event.preventDefault();
        const factor = event.deltaY < 0 ? 0.87 : 1.15;
        const previous = { ...state.viewport };
        const nextWidth = Math.max(
          250,
          Math.min(8000, previous.width * factor),
        );
        const nextHeight = Math.max(
          180,
          Math.min(6000, previous.height * factor),
        );
        const box = graphElement.getBoundingClientRect();
        const ratioX = Math.min(
          1,
          Math.max(0, (event.clientX - box.left) / box.width),
        );
        const ratioY = Math.min(
          1,
          Math.max(0, (event.clientY - box.top) / box.height),
        );
        state.viewport.x = previous.x + (previous.width - nextWidth) * ratioX;
        state.viewport.y = previous.y + (previous.height - nextHeight) * ratioY;
        state.viewport.width = nextWidth;
        state.viewport.height = nextHeight;
        setViewport(state.viewport, false);
      },
      { passive: false },
    );

    graphElement.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !state.viewport.initialized) return;
      // A resource node is a control, not a drag handle. Keeping its pointer
      // sequence out of the pan state makes a normal click reliable.
      if (event.target.closest(".graph-node")) return;
      graphElement.focus({ preventScroll: true });
      graphElement.setPointerCapture(event.pointerId);
      state.dragging = {
        startX: event.clientX,
        startY: event.clientY,
        viewport: { ...state.viewport },
        moved: false,
      };
    });
    graphElement.addEventListener("pointermove", (event) => {
      if (!state.dragging) return;
      const box = graphElement.getBoundingClientRect();
      const deltaX = event.clientX - state.dragging.startX;
      const deltaY = event.clientY - state.dragging.startY;
      if (!state.dragging.moved && Math.hypot(deltaX, deltaY) < 3) return;
      state.dragging.moved = true;
      graphElement.classList.add("is-panning");
      state.viewport.x =
        state.dragging.viewport.x -
        (deltaX / box.width) * state.dragging.viewport.width;
      state.viewport.y =
        state.dragging.viewport.y -
        (deltaY / box.height) * state.dragging.viewport.height;
      setViewport(state.viewport, false);
    });
    const stopDragging = (event) => {
      if (event && graphElement.hasPointerCapture(event.pointerId)) {
        graphElement.releasePointerCapture(event.pointerId);
      }
      state.dragging = null;
      graphElement.classList.remove("is-panning");
    };
    graphElement.addEventListener("pointerup", stopDragging);
    graphElement.addEventListener("pointercancel", stopDragging);
  }

  function setupKeyboardNavigation() {
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target.isContentEditable
      ) {
        return;
      }
      if (
        !Object.hasOwn(
          { ArrowLeft: true, ArrowRight: true, ArrowUp: true, ArrowDown: true },
          event.key,
        )
      ) {
        return;
      }
      event.preventDefault();
      navigateGraph(event.key);
    });
  }

  function navigateGraph(key) {
    const visible = visibleGraphNodes()
      .slice()
      .sort((left, right) => left.address.localeCompare(right.address));
    if (!visible.length) return;
    if (!state.selectedID) {
      selectNode(visible[0].id, { center: true });
      return;
    }

    const visibleIDs = new Set(visible.map((node) => node.id));
    const current = state.nodesByID.get(state.selectedID);
    const dependencies = (current?.dependencies || [])
      .filter((id) => visibleIDs.has(id))
      .sort();
    const dependents = state.graph.edges
      .filter((edge) => edge.from === state.selectedID && visibleIDs.has(edge.to))
      .map((edge) => edge.to)
      .sort();
    let nextID;
    if (key === "ArrowLeft") nextID = dependencies[0];
    if (key === "ArrowRight") nextID = dependents[0];
    if (key === "ArrowUp" || key === "ArrowDown") {
      const index = visible.findIndex((node) => node.id === state.selectedID);
      const direction = key === "ArrowUp" ? -1 : 1;
      nextID = visible[(index + direction + visible.length) % visible.length].id;
    }
    if (nextID) selectNode(nextID, { center: true });
  }

  function centerViewportOn(id) {
    const position = state.nodePositions.get(id);
    if (!position) return;
    state.viewport.x = position.x + nodeWidth / 2 - state.viewport.width / 2;
    state.viewport.y = position.y + nodeHeight / 2 - state.viewport.height / 2;
    setViewport(state.viewport, false);
  }
})();
