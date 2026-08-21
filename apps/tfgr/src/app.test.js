import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, test } from "bun:test";
import { JSDOM } from "jsdom";

const webDirectory = new URL("../cmd/tfgr/web/", import.meta.url);
const indexHTML = readFileSync(new URL("index.html", webDirectory), "utf8");
const appSource = readFileSync(new URL("app.js", webDirectory), "utf8");
const styles = readFileSync(new URL("styles.css", webDirectory), "utf8");

const graph = {
  nodes: [
    {
      id: "aws_vpc.network",
      address: "aws_vpc.network",
      mode: "managed",
      type: "aws_vpc",
      name: "network",
      action: "no-op",
      actions: ["no-op"],
      dependencies: [],
      values: { cidr_block: "10.0.0.0/16" },
    },
    {
      id: "aws_instance.api",
      address: "aws_instance.api",
      mode: "managed",
      type: "aws_instance",
      name: "api",
      action: "update",
      actions: ["update"],
      dependencies: ["aws_vpc.network"],
      before: { instance_type: "t3.micro", tags: { Environment: "demo" } },
      after: { instance_type: "t3.small", tags: { Environment: "test" } },
      changes: [
        {
          path: "instance_type",
          before: "t3.micro",
          after: "t3.small",
        },
        {
          path: "tags.Environment",
          before: "demo",
          after: "test",
        },
      ],
    },
    {
      id: "aws_instance.worker",
      address: "aws_instance.worker",
      mode: "managed",
      type: "aws_instance",
      name: "worker",
      action: "create",
      actions: ["create"],
      dependencies: ["aws_instance.api"],
      after: { instance_type: "t3.small" },
    },
  ],
  edges: [
    { from: "aws_vpc.network", to: "aws_instance.api" },
    { from: "aws_instance.api", to: "aws_instance.worker" },
  ],
  summary: {
    total: 3,
    actions: { "no-op": 1, update: 1, create: 1 },
    drifted: 0,
  },
};

let dom;
let window;

beforeEach(async () => {
  dom?.window.close();
  dom = new JSDOM(indexHTML, {
    runScripts: "outside-only",
    url: "http://tfgr.test/tfgr/",
  });
  window = dom.window;
  window.fetch = async () => ({
    status: 200,
    ok: true,
    json: async () => graph,
  });
  window.SVGElement.prototype.setPointerCapture = () => {};
  window.SVGElement.prototype.releasePointerCapture = () => {};
  window.SVGElement.prototype.hasPointerCapture = () => false;

  const graphElement = window.document.querySelector("#graph");
  graphElement.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: 1000,
    height: 600,
  });
  window.eval(appSource);
  await new Promise((resolve) => window.setTimeout(resolve, 0));
  expect(window.document.querySelectorAll(".graph-node")).toHaveLength(3);
});

function graphNode(address) {
  return window.document.querySelector(`[aria-label="${address}"]`);
}

function select(address) {
  graphNode(address).dispatchEvent(
    new window.MouseEvent("click", { bubbles: true }),
  );
}

function selectedAddress() {
  return window.document.querySelector("#details .address")?.textContent;
}

function actionFilter(action) {
  return [...window.document.querySelectorAll(".action-filter")]
    .find((label) => label.textContent === action)
    .querySelector("input");
}

function hideAction(action) {
  const checkbox = actionFilter(action);
  checkbox.checked = false;
  checkbox.dispatchEvent(new window.Event("change", { bubbles: true }));
}

describe("graph interactions", () => {
  test("hides the empty graph overlay while resources are visible", () => {
    expect(window.document.querySelector("#empty-graph").hidden).toBe(true);
    expect(styles).toContain(".empty-graph[hidden]");
    expect(styles).toContain("display: none;");
  });

  test("selects a resource after a normal pointer click", () => {
    const graphElement = window.document.querySelector("#graph");
    const node = graphNode("aws_instance.api");

    node.dispatchEvent(
      new window.MouseEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: 400,
        clientY: 250,
      }),
    );
    graphElement.dispatchEvent(
      new window.MouseEvent("pointerup", { bubbles: true }),
    );
    node.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));

    expect(selectedAddress()).toBe("aws_instance.api");
  });

  test("pans when dragging the graph background", () => {
    const graphElement = window.document.querySelector("#graph");
    const before = graphElement.getAttribute("viewBox");

    graphElement.dispatchEvent(
      new window.MouseEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: 400,
        clientY: 250,
      }),
    );
    graphElement.dispatchEvent(
      new window.MouseEvent("pointermove", {
        bubbles: true,
        clientX: 520,
        clientY: 310,
      }),
    );
    graphElement.dispatchEvent(
      new window.MouseEvent("pointerup", { bubbles: true }),
    );

    expect(graphElement.getAttribute("viewBox")).not.toBe(before);
  });

  test("zooms around the pointer position", () => {
    const graphElement = window.document.querySelector("#graph");
    const before = graphElement.getAttribute("viewBox");
    const event = new window.WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: -100,
      clientX: 750,
      clientY: 300,
    });

    graphElement.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(graphElement.getAttribute("viewBox")).not.toBe(before);
  });

  test("refits the graph after action filters change", () => {
    const graphElement = window.document.querySelector("#graph");
    graphElement.dispatchEvent(
      new window.MouseEvent("pointerdown", {
        bubbles: true,
        button: 0,
        clientX: 800,
        clientY: 300,
      }),
    );
    graphElement.dispatchEvent(
      new window.MouseEvent("pointermove", {
        bubbles: true,
        clientX: -1200,
        clientY: 300,
      }),
    );
    graphElement.dispatchEvent(
      new window.MouseEvent("pointerup", { bubbles: true }),
    );
    expect(graphElement.getAttribute("viewBox")).not.toStartWith("0 0 ");

    hideAction("update");

    expect(window.document.querySelectorAll(".graph-node")).toHaveLength(2);
    expect(window.document.querySelector("#empty-graph").hidden).toBe(true);
    expect(graphElement.getAttribute("viewBox")).toStartWith("0 0 ");
  });

  test("returns to the whole graph when filtering out the focus anchor", () => {
    select("aws_vpc.network");
    window.document.querySelector('[data-focus="one"]').click();
    expect(window.document.querySelectorAll(".graph-node")).toHaveLength(2);

    hideAction("no change");

    expect(window.document.querySelectorAll(".graph-node")).toHaveLength(2);
    expect(
      window.document.querySelector('[data-focus="all"]').classList,
    ).toContain("is-active");
  });

  test("shows changed attributes with both values without collapsible controls", () => {
    select("aws_instance.api");

    const changes = window.document.querySelector("#details .changes");
    expect(changes.textContent).toContain("instance_type");
    expect(changes.textContent).toContain("t3.micro");
    expect(changes.textContent).toContain("t3.small");
    expect(changes.querySelectorAll("details")).toHaveLength(0);
    expect(changes.querySelectorAll(".change")).toHaveLength(2);
  });

  test("uses arrow keys to follow dependencies and dependents", () => {
    select("aws_vpc.network");

    const firstArrow = new window.KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "ArrowRight",
    });
    window.document.dispatchEvent(firstArrow);
    expect(firstArrow.defaultPrevented).toBe(true);
    expect(selectedAddress()).toBe("aws_instance.api");

    window.document.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "ArrowRight",
      }),
    );
    expect(selectedAddress()).toBe("aws_instance.worker");

    window.document.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "ArrowLeft",
      }),
    );
    expect(selectedAddress()).toBe("aws_instance.api");
  });

  test("does not navigate or scroll while typing in the resource search", () => {
    const search = window.document.querySelector("#search");
    const event = new window.KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "ArrowDown",
    });

    search.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(selectedAddress()).toBeUndefined();
  });
});
