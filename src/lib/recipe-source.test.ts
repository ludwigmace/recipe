import { describe, expect, it } from "vitest";
import { getRecipeSourceDomain } from "./recipe-source";

describe("getRecipeSourceDomain", () => {
  it("returns the hostname without a leading www prefix", () => {
    expect(getRecipeSourceDomain("https://www.jaroflemons.com/wprm_print/154350"))
      .toBe("jaroflemons.com");
  });

  it("preserves hostnames that do not use www", () => {
    expect(getRecipeSourceDomain("https://natashaskitchen.com/recipe"))
      .toBe("natashaskitchen.com");
  });

  it("uses a safe fallback for malformed URLs", () => {
    expect(getRecipeSourceDomain("not a URL")).toBe("Recipe website");
  });
});
