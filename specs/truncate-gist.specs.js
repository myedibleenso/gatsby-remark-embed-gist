import { truncateGist } from "../src/index";

describe("option: truncate can reduce html bulk", () => {
  it("can truncate <td> line num fragments", () => {
    const input =
      '<td id="file-example-sh-L420" class="blob-num js-line-number" data-line-number="3"></td>';
    const expected = '<td id="L420" class="b-n js-ln" data-ln="3"></td>';
    expect(truncateGist(input, true)).toBe(expected);
  });
  it("can truncate <td> code fragments", () => {
    const input =
      '<td id="file-example-sh-LC420" class="blob-code blob-code-inner js-file-line">hello world</td>';
    const expected =
      '<td id="LC420" class="b-c b-c-inner js-fln">hello world</td>';
    expect(truncateGist(input, true)).toBe(expected);
  });
});
