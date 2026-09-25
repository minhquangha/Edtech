// backend/test/eval/runners/feature1-matrix.eval.ts

import AiService from "@/services/ai.js";
import { LessonRepository } from "@/repositories/lesson.repository.js";
import type { AiRequest } from "@/types/ai-service.js";
import { validateAssignmentSchema } from "../metrics/code-based/schemaValidator.js";
import { validateConstraints } from "../metrics/code-based/constraintValidator.js";
import { validateQuestionIntegrity } from "../metrics/code-based/questionIntegrity.js";
import { checkIntraExamDuplicate } from "../metrics/code-based/duplicateChecker.js";
import { validateLatexSyntax } from "../metrics/code-based/latexValidator.js";
import { evaluateWithLlmJudge } from "../metrics/llm-judge/judgeClient.js";
import { EvaluationReporter, type TestCaseResult } from "../reporters/evalReporter.js";

export async function runFeature1Evaluation(reporter?: EvaluationReporter): Promise<EvaluationReporter> {
  const localReporter = reporter || new EvaluationReporter();
  console.log("\n========================================================");
  console.log(" BẮT ĐẦU ĐÁNH GIÁ TÍNH NĂNG 1: TẠO ĐỀ TỪ MA TRẬN BÀI HỌC ");
  console.log("========================================================\n");

  const testCases: Array<{
    id: string;
    type: "Happy Path" | "Edge Case";
    scenario: string;
    purpose: string;
    demand: AiRequest;
    customMock?: () => () => void;
    requireLatexCheck?: boolean;
    requireJudge?: boolean;
  }> = [
      {
        id: "D-01",
        type: "Happy Path",
        scenario: "1 bài học, 5 câu SINGLE_CHOICE, mức Nhận biết",
        purpose: "Kiểm tra luồng tạo đề cơ bản",
        demand: {
          data: {
            class_level: "12",
            subject: "Vật lí",
            title: "Đề kiểm tra D-01: Nhận biết",
            description: "Đề kiểm tra trắc nghiệm 5 câu mức Nhận biết",
            time_duration: 15,
            question_config: {
              groups: [
                {
                  topic: "Cấu trúc chất",
                  count: 5,
                  difficulty: "NB",
                  type: "SINGLE_CHOICE",
                  lessonIds: [1],
                },
              ],
            },
          },
        },
        requireJudge: true,
      },
      {
        id: "D-02",
        type: "Happy Path",
        scenario: "10 câu, tỷ lệ 4 NB – 4 TH – 2 VD",
        purpose: "Kiểm tra phân bổ đúng ma trận độ khó",
        demand: {
          data: {
            class_level: "12",
            subject: "Vật lí",
            title: "Đề kiểm tra D-02: Ma trận đa cấp độ",
            description: "10 câu phân bổ 4 NB, 4 TH, 2 VD",
            time_duration: 30,
            question_config: {
              groups: [
                { count: 4, difficulty: "NB", type: "SINGLE_CHOICE", lessonIds: [1] },
                { count: 4, difficulty: "TH", type: "SINGLE_CHOICE", lessonIds: [1] },
                { count: 2, difficulty: "VD", type: "SINGLE_CHOICE", lessonIds: [1] },
              ],
            },
          },
        },
        requireJudge: true,
      },
      {
        id: "D-03",
        type: "Happy Path",
        scenario: "Ghép 2 bài học, 10 câu",
        purpose: "Kiểm tra khả năng tổng hợp kiến thức liên bài",
        demand: {
          data: {
            class_level: "12",
            subject: "Vật lí",
            title: "Đề kiểm tra D-03: Liên bài 10 & 11",
            description: "Ghép kiến thức Định luật Charles và Khí lí tưởng",
            time_duration: 30,
            question_config: {
              groups: [
                { count: 5, difficulty: "TH", type: "SINGLE_CHOICE", lessonIds: [2] },
                { count: 5, difficulty: "TH", type: "SINGLE_CHOICE", lessonIds: [3] },
              ],
            },
          },
        },
        requireJudge: true,
      },
      {
        id: "D-04",
        type: "Happy Path",
        scenario: "4 câu TRUE_FALSE",
        purpose: "Kiểm tra định dạng câu hỏi Đúng/Sai",
        demand: {
          data: {
            class_level: "12",
            subject: "Vật lí",
            title: "Đề kiểm tra D-04: Đúng/Sai",
            description: "Kiểm tra định dạng True/False",
            time_duration: 15,
            question_config: {
              groups: [
                { count: 4, difficulty: "NB", type: "TRUE_FALSE", lessonIds: [1] },
              ],
            },
          },
        },
      },
      {
        id: "D-05",
        type: "Happy Path",
        scenario: "3 câu SHORT_ANSWER dạng tính toán",
        purpose: "Kiểm tra câu hỏi tự luận và đáp án mẫu",
        demand: {
          data: {
            class_level: "12",
            subject: "Vật lí",
            title: "Đề kiểm tra D-05: Điền đáp số ngắn",
            description: "3 câu tự luận tính toán Định luật Charles",
            time_duration: 20,
            question_config: {
              groups: [
                { count: 3, difficulty: "TH", type: "SHORT_ANSWER", lessonIds: [2] },
              ],
            },
          },
        },
        requireJudge: true,
      },
      {
        id: "D-06",
        type: "Happy Path",
        scenario: "Đề kết hợp 3 dạng (Single Choice + True/False + Short)",
        purpose: "Xử lý đa dạng loại câu hỏi trong 1 đề",
        demand: {
          data: {
            class_level: "12",
            subject: "Vật lí",
            title: "Đề kiểm tra D-06: Đa dạng hình thức",
            description: "Hỗn hợp Single Choice, Đúng Sai và Tự luận ngắn",
            time_duration: 25,
            question_config: {
              groups: [
                { count: 3, difficulty: "NB", type: "SINGLE_CHOICE", lessonIds: [1] },
                { count: 2, difficulty: "TH", type: "TRUE_FALSE", lessonIds: [1] },
                { count: 1, difficulty: "VD", type: "SHORT_ANSWER", lessonIds: [1] },
              ],
            },
          },
        },
      },
      {
        id: "D-07",
        type: "Edge Case",
        scenario: "Chỉ yêu cầu đúng 1 câu Vận dụng",
        purpose: "AI không sinh thừa câu hỏi",
        demand: {
          data: {
            class_level: "12",
            subject: "Vật lí",
            title: "Đề kiểm tra D-07: Giới hạn tối thiểu",
            description: "Duy nhất 1 câu hỏi Vận dụng",
            time_duration: 10,
            question_config: {
              groups: [
                { count: 1, difficulty: "VD", type: "SINGLE_CHOICE", lessonIds: [3] },
              ],
            },
          },
        },
        requireJudge: true,
      },
      {
        id: "D-08",
        type: "Edge Case",
        scenario: "100% câu hỏi ở mức Vận dụng",
        purpose: "Kiểm tra khả năng tuân thủ mức độ khó",
        demand: {
          data: {
            class_level: "12",
            subject: "Vật lí",
            title: "Đề kiểm tra D-08: 100% Vận dụng",
            description: "Yêu cầu 5 câu đều ở mức Vận dụng cao",
            time_duration: 20,
            question_config: {
              groups: [
                { count: 5, difficulty: "VD", type: "SINGLE_CHOICE", lessonIds: [3] },
              ],
            },
          },
        },
        requireJudge: true,
      },
      {
        id: "D-09",
        type: "Edge Case",
        scenario: "Bài học rút gọn chỉ có 2 dòng văn bản; yêu cầu sinh 10 câu",
        purpose: "Duplicate Check: Không lặp câu khi context ít; chống hallucination",
        demand: {
          data: {
            class_level: "12",
            subject: "Vật lí",
            title: "Đề kiểm tra D-09: Context tối thiểu",
            description: "Sinh 10 câu từ bài học chỉ có 2 dòng",
            time_duration: 30,
            question_config: {
              groups: [
                { count: 10, difficulty: "NB", type: "SINGLE_CHOICE", lessonIds: [1] },
              ],
            },
          },
        },
        customMock: () => {
          const orig = LessonRepository.findContentsByIds;
          LessonRepository.findContentsByIds = async (ids: number[]) => [
            {
              id: ids[0] || 1,
              lesson_number: 1,
              title: "Cấu trúc vật chất vi mô",
              content: "Vật chất được cấu tạo từ các phân tử chuyển động không ngừng.\nKhi nhiệt độ của vật càng cao thì các phân tử cấu tạo nên vật chuyển động càng nhanh.",
            },
          ];
          return () => {
            LessonRepository.findContentsByIds = orig;
          };
        },
        requireJudge: true,
      },
      {
        id: "D-10",
        type: "Edge Case",
        scenario: "Nhiều công thức LaTeX phức tạp: Δt, V1/T1, °C",
        purpose: "Kiểm tra JSON escape và tính hợp lệ KaTeX",
        demand: {
          data: {
            class_level: "12",
            subject: "Vật lí",
            title: "Đề kiểm tra D-10: Công thức phức tạp",
            description: "Nhiều công thức LaTeX nhiệt động lực học",
            time_duration: 20,
            question_config: {
              groups: [
                { count: 4, difficulty: "TH", type: "SINGLE_CHOICE", lessonIds: [3] },
              ],
            },
          },
        },
        requireLatexCheck: true,
        requireJudge: true,
      },
    ];

  for (const tc of testCases) {
    console.log(`\n---> [EXEC] Đang chạy Test Case ${tc.id}: ${tc.scenario}...`);
    const startTime = Date.now();
    let restoreMock: (() => void) | null = null;

    if (tc.customMock) {
      restoreMock = tc.customMock();
    }

    try {
      const generatedAssignment = await AiService.create(tc.demand);
      const durationMs = Date.now() - startTime;
      console.log(`✓ Đã tạo xong đề sau ${(durationMs / 1000).toFixed(2)}s. Bắt đầu đánh giá 2 tầng...`);

      // -----------------------------------------------------------------------
      // TẦNG 1: CODE-BASED VALIDATIONS (0-token)
      // -----------------------------------------------------------------------
      const schemaRes = validateAssignmentSchema(generatedAssignment);
      const constraintRes = validateConstraints(tc.demand, generatedAssignment.questions);
      const integrityRes = validateQuestionIntegrity(generatedAssignment.questions);
      const dupRes = checkIntraExamDuplicate(generatedAssignment.questions);

      let latexPassed = true;
      const t1Errors: string[] = [
        ...schemaRes.errors,
        ...constraintRes.errors,
        ...integrityRes.errors.map((e) => `[Q${e.questionIndex}] ${e.message}`),
      ];

      if (tc.requireLatexCheck) {
        for (const q of generatedAssignment.questions) {
          const ltx = validateLatexSyntax(q.content);
          if (!ltx.passed) {
            latexPassed = false;
            t1Errors.push(...ltx.errors);
          }
        }
      }

      if (!dupRes.passed) {
        t1Errors.push(`Phát hiện ${dupRes.duplicatePairs.length} cặp câu trùng lặp (Max Sim: ${(dupRes.maxSimilarity * 100).toFixed(1)}%)`);
      }

      const tier1Passed = schemaRes.passed && constraintRes.passed && integrityRes.passed && dupRes.passed && latexPassed;

      // -----------------------------------------------------------------------
      // TẦNG 2: LLM-AS-A-JUDGE (ƯU TIÊN DEEPSEEK)
      // -----------------------------------------------------------------------
      let tier2Res = undefined;
      if (tc.requireJudge && generatedAssignment.questions.length > 0) {
        console.log("--> Đang gọi Giám khảo LLM-as-a-Judge (Ưu tiên DeepSeek)...");
        try {
          const lessonContents = await LessonRepository.findContentsByIds(
            tc.demand.data.question_config.groups.flatMap((g) => g.lessonIds)
          );
          const sourceText = lessonContents.map((l) => `${l.title}\n${l.content}`).join("\n\n");

          tier2Res = await evaluateWithLlmJudge(sourceText, generatedAssignment.questions, {
            mode: "MATRIX",
          });
          console.log(`     ✓ Chấm xong bởi ${tier2Res.modelUsed} | Faithfulness: ${tier2Res.faithfulness} | Sci: ${tier2Res.scientific_correctness}`);
        } catch (judgeErr: any) {
          console.warn(`     ⚠️ Lỗi khi gọi Giám khảo LLM: ${judgeErr.message}`);
        }
      }

      const overallPassed = tier1Passed && (tier2Res ? tier2Res.overall_passed : true);

      localReporter.addResult({
        id: tc.id,
        feature: "Theo yêu cầu",
        type: tc.type,
        scenario: tc.scenario,
        purpose: tc.purpose,
        passed: overallPassed,
        durationMs,
        tier1: {
          passed: tier1Passed,
          constraintPassed: constraintRes.passed,
          integrityPassed: integrityRes.passed,
          duplicatePassed: dupRes.passed,
          maxSimilarity: dupRes.maxSimilarity,
          latexPassed,
          errors: t1Errors,
        },
        tier2: tier2Res,
      });

      console.log(`     => Kết quả ${tc.id}: ${overallPassed ? "PASSED ✅" : "FAILED ❌"}`);
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      console.error(`     ❌ Lỗi khi thực thi ${tc.id}:`, err.message);
      localReporter.addResult({
        id: tc.id,
        feature: "Theo yêu cầu",
        type: tc.type,
        scenario: tc.scenario,
        purpose: tc.purpose,
        passed: false,
        durationMs,
        tier1: {
          passed: false,
          errors: [err.message],
        },
        error: err.message,
      });
    } finally {
      if (restoreMock) {
        restoreMock();
      }
    }
  }

  return localReporter;
}

if (process.argv[1]?.includes("feature1-matrix.eval")) {
  runFeature1Evaluation().then((reporter) => {
    reporter.printConsoleSummary();
    reporter.saveMarkdownReport("test/eval/feature1-report.md");
    process.exit(0);
  }).catch((err) => {
    console.error("Runner Fatal Error:", err);
    process.exit(1);
  });
}
