import { describe, test, expect } from "bun:test";
import {
  parseJsonPlan,
  parseTextPlan,
  getActionEmoji,
  getActionLabel,
  groupByModule,
  generateMarkdown,
  generatePlaintext,
  type PlanOutput,
  type ParsedChange,
} from "../plan-utils";

describe("parseJsonPlan", () => {
  test("parses a plan with create action", () => {
    const plan: PlanOutput = {
      format_version: "1.0",
      terraform_version: "1.5.0",
      resource_changes: [
        {
          address: "aws_instance.web",
          mode: "managed",
          type: "aws_instance",
          name: "web",
          provider_name: "aws",
          change: {
            actions: ["create"],
            after: { ami: "ami-123", instance_type: "t3.micro" },
          },
        },
      ],
    };

    const result = parseJsonPlan(plan);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("create");
    expect(result[0].isDestructive).toBe(false);
    expect(result[0].address).toBe("aws_instance.web");
    expect(result[0].type).toBe("aws_instance");
    expect(result[0].name).toBe("web");
    expect(result[0].resourceModule).toBe("root");
    expect(result[0].after).toEqual({ ami: "ami-123", instance_type: "t3.micro" });
  });

  test("parses a plan with delete action", () => {
    const plan: PlanOutput = {
      format_version: "1.0",
      terraform_version: "1.5.0",
      resource_changes: [
        {
          address: "aws_s3_bucket.old",
          mode: "managed",
          type: "aws_s3_bucket",
          name: "old",
          provider_name: "aws",
          change: {
            actions: ["delete"],
            before: { bucket: "old-bucket" },
          },
        },
      ],
    };

    const result = parseJsonPlan(plan);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("delete");
    expect(result[0].isDestructive).toBe(true);
    expect(result[0].before).toEqual({ bucket: "old-bucket" });
  });

  test("parses a plan with update action", () => {
    const plan: PlanOutput = {
      format_version: "1.0",
      terraform_version: "1.5.0",
      resource_changes: [
        {
          address: "aws_instance.web",
          mode: "managed",
          type: "aws_instance",
          name: "web",
          provider_name: "aws",
          change: {
            actions: ["update"],
            before: { instance_type: "t3.micro" },
            after: { instance_type: "t3.small" },
          },
        },
      ],
    };

    const result = parseJsonPlan(plan);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("update");
    expect(result[0].isDestructive).toBe(false);
  });

  test("parses a plan with replace (delete+create) action", () => {
    const plan: PlanOutput = {
      format_version: "1.0",
      terraform_version: "1.5.0",
      resource_changes: [
        {
          address: "aws_instance.web",
          mode: "managed",
          type: "aws_instance",
          name: "web",
          provider_name: "aws",
          change: {
            actions: ["delete", "create"],
            before: { ami: "ami-old" },
            after: { ami: "ami-new" },
          },
        },
      ],
    };

    const result = parseJsonPlan(plan);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("replace");
    expect(result[0].isDestructive).toBe(true);
  });

  test("parses a plan with read action", () => {
    const plan: PlanOutput = {
      format_version: "1.0",
      terraform_version: "1.5.0",
      resource_changes: [
        {
          address: "data.aws_ami.latest",
          mode: "data",
          type: "aws_ami",
          name: "latest",
          provider_name: "aws",
          change: {
            actions: ["read"],
          },
        },
      ],
    };

    const result = parseJsonPlan(plan);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("read");
    expect(result[0].isDestructive).toBe(false);
  });

  test("skips no-op resources", () => {
    const plan: PlanOutput = {
      format_version: "1.0",
      terraform_version: "1.5.0",
      resource_changes: [
        {
          address: "aws_instance.existing",
          mode: "managed",
          type: "aws_instance",
          name: "existing",
          provider_name: "aws",
          change: {
            actions: ["no-op"],
          },
        },
      ],
    };

    const result = parseJsonPlan(plan);
    expect(result).toHaveLength(0);
  });

  test("extracts module name from address", () => {
    const plan: PlanOutput = {
      format_version: "1.0",
      terraform_version: "1.5.0",
      resource_changes: [
        {
          address: "module.vpc.aws_subnet.public",
          mode: "managed",
          type: "aws_subnet",
          name: "public",
          provider_name: "aws",
          change: {
            actions: ["create"],
            after: { cidr_block: "10.0.1.0/24" },
          },
        },
      ],
    };

    const result = parseJsonPlan(plan);
    expect(result[0].resourceModule).toBe("module.vpc");
  });

  test("returns empty array for plan with no resource_changes", () => {
    const plan: PlanOutput = {
      format_version: "1.0",
      terraform_version: "1.5.0",
    };

    const result = parseJsonPlan(plan);
    expect(result).toHaveLength(0);
  });

  test("handles multiple resource changes", () => {
    const plan: PlanOutput = {
      format_version: "1.0",
      terraform_version: "1.5.0",
      resource_changes: [
        {
          address: "aws_instance.a",
          mode: "managed",
          type: "aws_instance",
          name: "a",
          provider_name: "aws",
          change: { actions: ["create"] },
        },
        {
          address: "aws_instance.b",
          mode: "managed",
          type: "aws_instance",
          name: "b",
          provider_name: "aws",
          change: { actions: ["delete"] },
        },
      ],
    };

    const result = parseJsonPlan(plan);
    expect(result).toHaveLength(2);
    expect(result[0].action).toBe("create");
    expect(result[1].action).toBe("delete");
  });
});

describe("parseTextPlan", () => {
  test("parses plan summary lines with created", () => {
    const text = "aws_instance.web will be created";
    const result = parseTextPlan(text);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("create");
    expect(result[0].isDestructive).toBe(false);
    expect(result[0].address).toBe("aws_instance.web");
    expect(result[0].type).toBe("aws_instance");
    expect(result[0].name).toBe("web");
  });

  test("parses plan summary lines with destroyed", () => {
    const text = "aws_s3_bucket.old will be destroyed";
    const result = parseTextPlan(text);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("delete");
    expect(result[0].isDestructive).toBe(true);
  });

  test("parses plan summary lines with updated", () => {
    const text = "aws_instance.web will be updated";
    const result = parseTextPlan(text);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("update");
    expect(result[0].isDestructive).toBe(false);
  });

  test("parses plan summary lines with replaced", () => {
    const text = "aws_instance.web will be replaced";
    const result = parseTextPlan(text);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("replace");
    expect(result[0].isDestructive).toBe(true);
  });

  test("parses action lines with + symbol", () => {
    const text = '  + resource "aws_instance" "web"';
    const result = parseTextPlan(text);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("create");
    expect(result[0].type).toBe("aws_instance");
    expect(result[0].name).toBe("web");
  });

  test("parses action lines with - symbol", () => {
    const text = '  - resource "aws_instance" "old"';
    const result = parseTextPlan(text);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("delete");
    expect(result[0].isDestructive).toBe(true);
  });

  test("parses action lines with ~ symbol", () => {
    const text = '  ~ resource "aws_instance" "web"';
    const result = parseTextPlan(text);
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("update");
  });

  test("tracks module context", () => {
    const text = [
      "module.vpc.aws_subnet.example will be created",
      '  + resource "aws_subnet" "public"',
    ].join("\n");
    const result = parseTextPlan(text);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].resourceModule).toBe("module.vpc");
  });

  test("returns empty array for empty text", () => {
    const result = parseTextPlan("");
    expect(result).toHaveLength(0);
  });

  test("returns empty array for text with no matching lines", () => {
    const result = parseTextPlan("some random text\nwith no terraform plan data");
    expect(result).toHaveLength(0);
  });
});

describe("getActionEmoji", () => {
  test("returns ➕ for create", () => {
    expect(getActionEmoji("create")).toBe("➕");
  });

  test("returns 🔄 for update", () => {
    expect(getActionEmoji("update")).toBe("🔄");
  });

  test("returns ♻️ for replace", () => {
    expect(getActionEmoji("replace")).toBe("♻️");
  });

  test("returns ❌ for delete", () => {
    expect(getActionEmoji("delete")).toBe("❌");
  });

  test("returns 📖 for read", () => {
    expect(getActionEmoji("read")).toBe("📖");
  });

  test("returns ❓ for unknown action", () => {
    expect(getActionEmoji("unknown" as ParsedChange["action"])).toBe("❓");
  });
});

describe("getActionLabel", () => {
  test("returns Add for create", () => {
    expect(getActionLabel("create")).toBe("Add");
  });

  test("returns Change for update", () => {
    expect(getActionLabel("update")).toBe("Change");
  });

  test("returns Replace for replace", () => {
    expect(getActionLabel("replace")).toBe("Replace");
  });

  test("returns Destroy for delete", () => {
    expect(getActionLabel("delete")).toBe("Destroy");
  });

  test("returns Read for read", () => {
    expect(getActionLabel("read")).toBe("Read");
  });

  test("returns Unknown for unknown action", () => {
    expect(getActionLabel("unknown" as ParsedChange["action"])).toBe("Unknown");
  });
});

describe("groupByModule", () => {
  test("groups changes by module", () => {
    const changes: ParsedChange[] = [
      {
        resourceModule: "root",
        address: "aws_instance.web",
        type: "aws_instance",
        name: "web",
        action: "create",
        isDestructive: false,
      },
      {
        resourceModule: "module.vpc",
        address: "module.vpc.aws_subnet.public",
        type: "aws_subnet",
        name: "public",
        action: "create",
        isDestructive: false,
      },
      {
        resourceModule: "root",
        address: "aws_s3_bucket.data",
        type: "aws_s3_bucket",
        name: "data",
        action: "update",
        isDestructive: false,
      },
    ];

    const result = groupByModule(changes);
    expect(result.size).toBe(2);
    expect(result.get("root")).toHaveLength(2);
    expect(result.get("module.vpc")).toHaveLength(1);
  });

  test("returns empty map for empty changes", () => {
    const result = groupByModule([]);
    expect(result.size).toBe(0);
  });

  test("handles single module", () => {
    const changes: ParsedChange[] = [
      {
        resourceModule: "root",
        address: "aws_instance.a",
        type: "aws_instance",
        name: "a",
        action: "create",
        isDestructive: false,
      },
      {
        resourceModule: "root",
        address: "aws_instance.b",
        type: "aws_instance",
        name: "b",
        action: "delete",
        isDestructive: true,
      },
    ];

    const result = groupByModule(changes);
    expect(result.size).toBe(1);
    expect(result.get("root")).toHaveLength(2);
  });
});

describe("generateMarkdown", () => {
  test("generates markdown for create action", () => {
    const changes: ParsedChange[] = [
      {
        resourceModule: "root",
        address: "aws_instance.web",
        type: "aws_instance",
        name: "web",
        action: "create",
        isDestructive: false,
      },
    ];

    const md = generateMarkdown(changes);
    expect(md).toContain("# Terraform Plan Summary");
    expect(md).toContain("## Summary");
    expect(md).toContain("- ➕ **Add**: 1");
    expect(md).toContain("- 🔄 **Change**: 0");
    expect(md).toContain("### root");
    expect(md).toContain("- ➕ **Add**: `aws_instance.web`");
  });

  test("generates markdown for destructive action with warning", () => {
    const changes: ParsedChange[] = [
      {
        resourceModule: "root",
        address: "aws_instance.old",
        type: "aws_instance",
        name: "old",
        action: "delete",
        isDestructive: true,
      },
    ];

    const md = generateMarkdown(changes);
    expect(md).toContain("- ❌ **Destroy** ⚠️: `aws_instance.old`");
    expect(md).toContain("- ❌ **Destroy**: 1");
  });

  test("generates markdown for multiple modules", () => {
    const changes: ParsedChange[] = [
      {
        resourceModule: "root",
        address: "aws_instance.web",
        type: "aws_instance",
        name: "web",
        action: "create",
        isDestructive: false,
      },
      {
        resourceModule: "module.vpc",
        address: "module.vpc.aws_subnet.public",
        type: "aws_subnet",
        name: "public",
        action: "update",
        isDestructive: false,
      },
    ];

    const md = generateMarkdown(changes);
    expect(md).toContain("### root");
    expect(md).toContain("### module.vpc");
    expect(md).toContain("- 🔄 **Change**: `module.vpc.aws_subnet.public`");
  });

  test("generates markdown for replace action", () => {
    const changes: ParsedChange[] = [
      {
        resourceModule: "root",
        address: "aws_instance.web",
        type: "aws_instance",
        name: "web",
        action: "replace",
        isDestructive: true,
      },
    ];

    const md = generateMarkdown(changes);
    expect(md).toContain("- ♻️ **Replace** ⚠️: `aws_instance.web`");
    expect(md).toContain("- ♻️ **Replace**: 1");
  });

  test("handles empty changes", () => {
    const md = generateMarkdown([]);
    expect(md).toContain("# Terraform Plan Summary");
    expect(md).toContain("- ➕ **Add**: 0");
    expect(md).toContain("- 🔄 **Change**: 0");
    expect(md).toContain("- ♻️ **Replace**: 0");
    expect(md).toContain("- ❌ **Destroy**: 0");
  });
});

describe("generatePlaintext", () => {
  test("generates plaintext for create action", () => {
    const changes: ParsedChange[] = [
      {
        resourceModule: "root",
        address: "aws_instance.web",
        type: "aws_instance",
        name: "web",
        action: "create",
        isDestructive: false,
      },
    ];

    const text = generatePlaintext(changes);
    expect(text).toContain("Terraform Plan Summary");
    expect(text).toContain("Summary:");
    expect(text).toContain("- Add: 1");
    expect(text).toContain("- Change: 0");
    expect(text).toContain("[root]");
    expect(text).toContain("  ADD: aws_instance.web");
  });

  test("generates plaintext for destructive action with warning", () => {
    const changes: ParsedChange[] = [
      {
        resourceModule: "root",
        address: "aws_instance.old",
        type: "aws_instance",
        name: "old",
        action: "delete",
        isDestructive: true,
      },
    ];

    const text = generatePlaintext(changes);
    expect(text).toContain("  DESTROY [DESTRUCTIVE]: aws_instance.old");
    expect(text).toContain("- Destroy: 1");
  });

  test("generates plaintext for multiple modules", () => {
    const changes: ParsedChange[] = [
      {
        resourceModule: "root",
        address: "aws_instance.web",
        type: "aws_instance",
        name: "web",
        action: "create",
        isDestructive: false,
      },
      {
        resourceModule: "module.vpc",
        address: "module.vpc.aws_subnet.public",
        type: "aws_subnet",
        name: "public",
        action: "update",
        isDestructive: false,
      },
    ];

    const text = generatePlaintext(changes);
    expect(text).toContain("[root]");
    expect(text).toContain("[module.vpc]");
    expect(text).toContain("  CHANGE: module.vpc.aws_subnet.public");
  });

  test("generates plaintext for replace action", () => {
    const changes: ParsedChange[] = [
      {
        resourceModule: "root",
        address: "aws_instance.web",
        type: "aws_instance",
        name: "web",
        action: "replace",
        isDestructive: true,
      },
    ];

    const text = generatePlaintext(changes);
    expect(text).toContain("  REPLACE [DESTRUCTIVE]: aws_instance.web");
    expect(text).toContain("- Replace: 1");
  });

  test("handles empty changes", () => {
    const text = generatePlaintext([]);
    expect(text).toContain("Terraform Plan Summary");
    expect(text).toContain("- Add: 0");
    expect(text).toContain("- Change: 0");
    expect(text).toContain("- Replace: 0");
    expect(text).toContain("- Destroy: 0");
  });
});
