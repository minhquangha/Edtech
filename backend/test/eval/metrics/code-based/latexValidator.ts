// backend/test/eval/metrics/code-based/latexValidator.ts

export interface LatexValidationResult {
  passed: boolean;
  totalFormulasDetected: number;
  unbalancedDelimitersCount: number;
  errors: string[];
}

/**
 * Kiểm tra tính hợp lệ của công thức LaTeX / KaTeX trong văn bản
 */
export function validateLatexSyntax(text: string): LatexValidationResult {
  const errors: string[] = [];
  let totalFormulasDetected = 0;

  if (!text) {
    return {
      passed: true,
      totalFormulasDetected: 0,
      unbalancedDelimitersCount: 0,
      errors: [],
    };
  }

  // 1. Đếm và kiểm tra cân bằng \( ... \)
  const inlineOpen = (text.match(/\\\(/g) || []).length;
  const inlineClose = (text.match(/\\\)/g) || []).length;
  if (inlineOpen !== inlineClose) {
    errors.push(
      `Mất cân bằng cặp dấu inline LaTeX \\( và \\): mở ${inlineOpen}, đóng ${inlineClose}`
    );
  }

  // 2. Đếm và kiểm tra cân bằng \[ ... \]
  const displayOpen = (text.match(/\\\[/g) || []).length;
  const displayClose = (text.match(/\\\]/g) || []).length;
  if (displayOpen !== displayClose) {
    errors.push(
      `Mất cân bằng cặp dấu display LaTeX \\[ và \\]: mở ${displayOpen}, đóng ${displayClose}`
    );
  }

  // 3. Đếm và kiểm tra cân bằng dấu ngoặc nhọn { } bên trong các đoạn toán học
  // Trích xuất các biểu thức LaTeX
  const latexBlocks: string[] = [];
  const regexMath = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g;
  let match: RegExpExecArray | null;

  while ((match = regexMath.exec(text)) !== null) {
    totalFormulasDetected++;
    const formulaContent = match[1] || match[2] || match[3] || match[4] || "";
    latexBlocks.push(formulaContent);

    // Kiểm tra ngoặc nhọn
    let braceCount = 0;
    for (let i = 0; i < formulaContent.length; i++) {
      if (formulaContent[i] === "{" && (i === 0 || formulaContent[i - 1] !== "\\")) {
        braceCount++;
      } else if (formulaContent[i] === "}" && (i === 0 || formulaContent[i - 1] !== "\\")) {
        braceCount--;
      }
      if (braceCount < 0) {
        errors.push(`Dư thừa dấu đóng ngoặc nhọn '}' trong công thức: "${formulaContent}"`);
        break;
      }
    }
    if (braceCount > 0) {
      errors.push(`Thiếu dấu đóng ngoặc nhọn '}' trong công thức: "${formulaContent}"`);
    }
  }

  // 4. Phát hiện các ký hiệu toán học chưa được bao bởi LaTeX delimiters (ví dụ: \Delta mà không có \( \))
  const nakedCommands = text.replace(regexMath, "").match(/\\[a-zA-Z]+/g) || [];
  const mathCommands = ["frac", "sqrt", "Delta", "alpha", "beta", "omega", "times", "approx"];
  for (const cmd of nakedCommands) {
    const cleanCmd = cmd.substring(1);
    if (mathCommands.includes(cleanCmd)) {
      errors.push(`Lệnh LaTeX '${cmd}' xuất hiện ngoài khối công thức \\( ... \\)`);
    }
  }

  const unbalancedCount =
    Math.abs(inlineOpen - inlineClose) + Math.abs(displayOpen - displayClose);

  return {
    passed: errors.length === 0,
    totalFormulasDetected,
    unbalancedDelimitersCount: unbalancedCount,
    errors,
  };
}
