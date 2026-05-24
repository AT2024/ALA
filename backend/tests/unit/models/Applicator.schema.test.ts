// Applicator model schema regression — guards the `inserted_seeds_qty` column.
// Without this column, Sequelize silently drops the user-entered value on
// Applicator.create(), and faulty applicators show "Inserted: 0" on the PDF.
// Patient-safety: the inserted-seed count is a medical record value, owned
// locally per the "LOCAL DB wins for SAFETY" rule.
import { describe, test, expect } from "@jest/globals";
import Applicator from "../../../src/models/Applicator";

describe("Applicator model schema", () => {
  test("declares insertedSeedsQty mapped to inserted_seeds_qty column", () => {
    const attrs = Applicator.rawAttributes as Record<
      string,
      { field?: string }
    >;
    expect(attrs.insertedSeedsQty).toBeDefined();
    expect(attrs.insertedSeedsQty.field).toBe("inserted_seeds_qty");
  });
});
