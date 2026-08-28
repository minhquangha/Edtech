# TECHNICAL DESIGN DOCUMENTATION - BACKEND SYSTEM (EDTECH PLATFORM)

---

## 1. TECH STACK (CÔNG NGHỆ SỬ DỤNG)

| Thành phần | Công nghệ / Thư viện | Mức phiên bản | Vai trò & Lý do lựa chọn |
| :--- | :--- | :--- | :--- |
| **Runtime Engine** | Node.js | v20+ (ES Modules) | Xử lý bất đồng bộ (Async I/O) hiệu năng cao, tối ưu cho API Gateway và các tác vụ I/O heavy. |
| **Language** | TypeScript | `^5.9.3` | Strong typing, giúp phát hiện lỗi từ compile-time, tăng tính bảo trì và độ tin cậy của mã nguồn. |
| **Web Framework** | Express.js | `^5.2.1` | Minimalist web framework phổ biến, nâng cấp v5 hỗ trợ async error handling mượt mà hơn. |
| **Database** | PostgreSQL | v15+ | Hệ quản trị cơ sở dữ liệu quan hệ (RDBMS) chuẩn ACID, hỗ trợ truy vấn quan hệ phức tạp và toàn vẹn dữ liệu. |
| **ORM & Driver** | Prisma ORM & `@prisma/adapter-pg` | `^7.9.1` | Type-safe ORM với Prisma Client, kết hợp Driver Adapter `pg.Pool` cho phép quản lý Connection Pooling tối ưu. |
| **AI Engine Integration** | Google GenAI SDK | `^2.16.0` | Tích hợp trực tiếp với model **`gemini-3.6-flash`**, hỗ trợ **Structured Outputs** (`responseSchema`) để ép kiểu JSON đầu ra chính xác 100%. |
| **Authentication** | JSON Web Token (`jsonwebtoken`) & `bcrypt` | `^9.0.3` / `^6.0.0` | Xác thực stateless bằng JWT Bearer Token, mã hóa mật khẩu người dùng chuẩn Bcrypt với Salt round = 10. |
| **File Processing & Storage** | `multer` & `pdf-parse` | `^2.1.1` / `^2.4.5` | Multer xử lý Upload file lưu tạm trên Memory Buffer (RAM). `pdf-parse` đọc và trích xuất text layer từ tài liệu PDF. |
| **Development & Tooling** | `tsx`, `tsconfig-paths`, `dotenv` | `^4.21.0` / `^4.2.0` | Thực thi và nạp mô hình TypeScript trực tiếp không cần compile trung gian trong môi trường dev; nạp biến môi trường. |

---

## 2. FOLDER STRUCTURE CỦA MODULE (CẤU TRÚC THƯ MỤC BACKEND)

Hệ thống được thiết kế theo kiến trúc **3-Tier Architecture** chuẩn (Controller - Service - Repository Pattern), phân tách rõ ràng trách nhiệm giữa xử lý HTTP Request, Business Logic và Data Access Layer.

```
backend/
├── .env                         # Biến môi trường (DATABASE_URL, JWT_SECRET, GEMINI_API_KEY, PORT...)
├── .env.example                 # Mẫu cấu hình môi trường
├── package.json                 # Khai báo dependencies & scripts
├── tsconfig.json                # Cấu hình TypeScript compiler & path aliases (@/*)
├── prisma.config.ts             # Cấu hình Prisma CLI
├── prisma/
│   └── schema.prisma            # Định nghĩa Data Model, Enums & Database Migration Config
├── scripts/
│   └── create-admin.ts          # Script CLI tạo tài khoản Admin ban đầu
└── src/
    ├── index.ts                 # Entry point: Khởi tạo Express app, Middlewares & Server Listener
    ├── config/                  # Cấu hình kết nối hạ tầng
    │   ├── db.ts                # Native DB config
    │   ├── prisma.ts            # Khởi tạo PrismaClient sử dụng PrismaPg adapter
    │   ├── gemini.ts            # Khởi tạo instance GoogleGenAI SDK với GEMINI_API_KEY
    │   └── deepseek.ts          # Cấu hình bổ sung cho các mô hình AI khác (nếu mở rộng)
    ├── controllers/             # HTTP Request Handlers (Validate request, gọi Service, trả về HTTP Status Code)
    │   ├── users.ts             # Xử lý Login & Register
    │   ├── assignments.ts       # Xử lý CRUD Đề thi/Bài tập & Lấy danh mục Khối/Môn/Bài
    │   ├── ai.ts                # Xử lý Request sinh đề tự động bằng AI Gemini
    │   └── pdfImport.ts         # Xử lý Request tải file PDF & phân tích tạo đề bằng AI
    ├── services/                # Business Logic Layer (Xử lý nghiệp vụ chính, tính toán, kết nối AI)
    │   ├── users.ts             # Mã hóa password, xác thực tài khoản, tạo JWT Token
    │   ├── assignments.ts       # Điều phối dữ liệu bài tập, ghép nối thông tin Khối/Môn
    │   ├── ai.ts                # Lấy nội dung bài học, dựng Prompt ma trận kiến thức & gọi Gemini API
    │   └── pdfImport.ts         # Kiểm tra văn bản PDF, dựng Prompt phân tích cấu trúc & gọi Gemini API
    ├── repositories/            # Data Access Layer (Tương tác trực tiếp với Database qua Prisma Transaction)
    │   ├── index.ts             # Export tổng hợp các Repositories
    │   ├── user.repository.ts   # Truy vấn thông tin User (findByUsername, create)
    │   ├── assignment.repository.ts # Thực thi Transaction tạo/sửa/xóa Assignment, Question, Option
    │   ├── lesson.repository.ts # Truy vấn bài học theo Khối/Môn và nạp nội dung bài học theo ID list
    │   └── curriculum.repository.ts # Truy vấn danh mục Khối (Grade) và Môn (Subject)
    ├── models/                  # Định nghĩa JSON Schema phục vụ Structured Output AI
    │   ├── ai-schema.ts         # Gemini JSON Schema (assignmentAiSchema) cho câu hỏi Trắc nghiệm, Đúng/Sai, Tự luận
    │   ├── assignment.ts       # Validation schema bài tập
    │   └── users.ts            # Schema dữ liệu người dùng
    ├── middlewares/             # Express Custom Middlewares
    │   ├── authenticator.ts     # Middleware kiểm tra Header `Authorization: Bearer <token>`, giải mã JWT vào `req.user`
    │   └── pdf.ts               # Cấu hình Multer upload giới hạn file size, số lượng và mimetype PDF
    ├── types/                   # TypeScript Interfaces & Type Definitions
    │   ├── express.d.ts         # Mở rộng Request type của Express để thêm thuộc tính `user`
    │   ├── assignments.ts       # Các DTOs: AssignmentRequest, QuestionRequest, AnswerRequest, AssignmentUpdateRequest...
    │   ├── ai-service.ts        # Interfaces cho Ma trận kiến thức: QuestionGroupConfig, AiRequest, LessonPayload...
    │   └── user.ts             # User interface
    └── utils/                   # Helper utilities
        └── test-db.ts           # Endpoint kiểm tra sức khỏe cơ sở dữ liệu (`/health`)
```

---

## 3. THIẾT KẾ DATABASE SCHEMA CHI TIẾT

### 3.1. Sơ đồ Thực thể Quan hệ (ERD - Entity Relationship Diagram)

```mermaid
erDiagram
    User ||--o{ Assignment : "tạo (1:N)"
    Grades ||--o{ Lessons : "chứa (1:N)"
    Subjects ||--o{ Lessons : "thuộc (1:N)"
    Assignment ||--o{ Lesson_Assignment : "liên kết (1:N)"
    Lessons ||--o{ Lesson_Assignment : "được chọn (1:N)"
    Assignment ||--o{ Assignment_Question : "chứa (1:N)"
    Question ||--o{ Assignment_Question : "thuộc bài tập (1:N)"
    Question ||--o{ Question_Options : "chứa các phương án (1:N)"

    User {
        Int id PK
        String username UK
        String password
        String role
        DateTime created_at
        DateTime updated_at
    }

    Grades {
        Int id PK
        Int grade UK
    }

    Subjects {
        Int id PK
        String subject UK
    }

    Lessons {
        Int id PK
        String content
        String title
        Int lesson_number
        Int subject_id FK
        Int grade_id FK
    }

    Assignment {
        Int id PK
        String title
        String description
        Int duration_minutes
        Int teacher_id FK
        DateTime created_at
        DateTime updated_at
    }

    Lesson_Assignment {
        Int assignment_id PK, FK
        Int lesson_id PK, FK
    }

    Question {
        Int id PK
        String content
        String question_type
        String answer
        DateTime created_at
        DateTime updated_at
    }

    Assignment_Question {
        Int assignment_id PK, FK
        Int question_id PK, FK
    }

    Question_Options {
        Int id PK
        Int question_id FK
        String content
        Boolean is_correct
        DateTime created_at
        DateTime updated_at
    }
```

### 3.2. Bảng Mô Tả Chi Tiết Các Bảng Database (Tables Schema)

#### Bảng `User` (`@@map("User")`)
Lưu trữ thông tin người dùng / giáo viên trong hệ thống.
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | Primary Key, Autoincrement | | Mã định danh duy nhất của người dùng |
| `username` | `VARCHAR` | Unique, Not Null | | Tên đăng nhập tài khoản |
| `password` | `VARCHAR` | Not Null | | Mật khẩu đã được băm (Bcrypt hash) |
| `role` | `VARCHAR` | Not Null | `"user"` | Vai trò hệ thống (`teacher`, `admin`, `user`) |
| `created_at` | `TIMESTAMP` | Not Null | `now()` | Thời gian tạo tài khoản |
| `updated_at` | `TIMESTAMP` | Not Null | `@updatedAt` | Thời gian cập nhật tài khoản gần nhất |

#### Bảng `Grades` (`@@map("Grades")`)
Danh mục Khối / Lớp học trong chương trình giáo dục.
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | Primary Key, Autoincrement | | Mã định danh khối lớp |
| `grade` | `INT` | Unique, Not Null | | Giá trị số của khối lớp (VD: 10, 11, 12) |

#### Bảng `Subjects` (`@@map("Subjects")`)
Danh mục Môn học (Toán, Vật Lý, Hóa Học...).
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | Primary Key, Autoincrement | | Mã định danh môn học |
| `subject` | `VARCHAR` | Unique, Not Null | | Tên môn học (VD: "Toán", "Vật lý") |

#### Bảng `Lessons` (`@@map("Lessons")`)
Chứa bài học thuộc từng Môn và Khối lớp.
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | Primary Key, Autoincrement | | Mã định danh bài học |
| `title` | `VARCHAR` | Not Null | | Tiêu đề bài học |
| `content` | `TEXT` | Not Null | | Nội dung kiến thức bài học (dùng cho AI RAG/Prompt) |
| `lesson_number`| `INT` | Not Null | | Số thứ tự bài học trong chương trình |
| `subject_id` | `INT` | Foreign Key -> `Subjects(id)` | | Thuộc môn học nào |
| `grade_id` | `INT` | Foreign Key -> `Grades(id)` | | Thuộc khối lớp nào |
| **Unique Index**| `(subject_id, grade_id, lesson_number)` | Unique | | Mỗi bài học có STT duy nhất trong 1 Môn/Khối |

#### Bảng `Assignment` (`@@map("Assignment")`)
Lưu trữ thông tin đề thi / bài tập do Giáo viên tạo hoặc sinh bởi AI.
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | Primary Key, Autoincrement | | Mã định danh bài tập |
| `title` | `VARCHAR` | Not Null | | Tiêu đề bài tập / đề kiểm tra |
| `description` | `TEXT` | Nullable | | Ghi chú / mô tả bài tập |
| `duration_minutes`| `INT` | Not Null | | Thời gian làm bài (tính theo phút) |
| `teacher_id` | `INT` | Foreign Key -> `User(id)` | | Giáo viên tạo bài tập |
| `created_at` | `TIMESTAMP` | Not Null | `now()` | Ngày tạo bài tập |
| `updated_at` | `TIMESTAMP` | Not Null | `@updatedAt` | Ngày sửa bài tập gần nhất |

#### Bảng `Lesson_Assignment` (`@@map("Lesson_Assignment")`)
Bảng trung gian liên kết Bài tập với các Bài học tương ứng (Quan hệ N-N).
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `assignment_id`| `INT` | Foreign Key -> `Assignment(id)` ON DELETE CASCADE | Mã bài tập |
| `lesson_id` | `INT` | Foreign Key -> `Lessons(id)` ON DELETE CASCADE | Mã bài học liên quan |
| **Primary Key** | `(assignment_id, lesson_id)` | Composite Primary Key | Khóa chính phức hợp |

#### Bảng `Question` (`@@map("Question")`)
Kho lưu trữ nội dung các câu hỏi.
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | Primary Key, Autoincrement | | Mã định danh câu hỏi |
| `content` | `TEXT` | Not Null | | Nội dung câu hỏi (chứa công thức LaTeX nếu có) |
| `question_type` | `VARCHAR` | Not Null | | Loại câu hỏi: `MULTIPLE_CHOICE`, `SINGLE_CHOICE`, `TRUE_FALSE`, `SHORT_ANSWER` |
| `answer` | `TEXT` | Nullable | | Đáp án ngắn (với SHORT_ANSWER) hoặc `true`/`false` (với TRUE_FALSE) |
| `created_at` | `TIMESTAMP` | Not Null | `now()` | Thời gian tạo |
| `updated_at` | `TIMESTAMP` | Not Null | `@updatedAt` | Thời gian cập nhật |

#### Bảng `Assignment_Question` (`@@map("Assignment_Question")`)
Bảng trung gian liên kết Bài tập với các Câu hỏi (Quan hệ N-N).
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- |
| `assignment_id`| `INT` | Foreign Key -> `Assignment(id)` ON DELETE CASCADE | Mã bài tập |
| `question_id` | `INT` | Foreign Key -> `Question(id)` ON DELETE CASCADE | Mã câu hỏi |
| **Primary Key** | `(assignment_id, question_id)` | Composite Primary Key | Khóa chính phức hợp |

#### Bảng `Question_Options` (`@@map("Question_Options")`)
Lưu các phương án lựa chọn A, B, C, D cho từng câu hỏi.
| Tên cột | Kiểu dữ liệu | Ràng buộc | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `INT` | Primary Key, Autoincrement | | Mã định danh phương án |
| `question_id` | `INT` | Foreign Key -> `Question(id)` ON DELETE CASCADE | Mã câu hỏi chứa phương án |
| `content` | `TEXT` | Not Null | | Nội dung phương án lựa chọn |
| `is_correct` | `BOOLEAN` | Not Null | | Trạng thái phương án ĐÚNG hay SAI |
| `created_at` | `TIMESTAMP` | Not Null | `now()` | Thời gian tạo |
| `updated_at` | `TIMESTAMP` | Not Null | `@updatedAt` | Thời gian cập nhật |

---

## 4. API CONTRACTS (TÀI LIỆU API CHI TIẾT)

### 4.1. Authentication Module

#### `POST /users/me/register`
* **Mô tả**: Đăng ký tài khoản người dùng mới.
* **Authentication**: None.
* **Request Body**:
  ```json
  {
    "data": {
      "username": "teacher_math_01",
      "password": "SecretPassword123!"
    }
  }
  ```
* **Response `200 OK`**:
  ```json
  {
    "id": 1,
    "username": "teacher_math_01",
    "role": "user",
    "created_at": "2026-08-24T10:00:00.000Z",
    "updated_at": "2026-08-24T10:00:00.000Z"
  }
  ```
* **Response `500 Internal Server Error`** (Tài khoản trùng):
  ```json
  {
    "message": "Username already exists"
  }
  ```

#### `POST /users/me/login`
* **Mô tả**: Đăng nhập tài khoản, cấp Access Token dạng JWT.
* **Authentication**: None.
* **Request Body**:
  ```json
  {
    "data": {
      "username": "teacher_math_01",
      "password": "SecretPassword123!"
    }
  }
  ```
* **Response `200 OK`**:
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "teacher_math_01",
      "role": "user"
    }
  }
  ```

---

### 4.2. Curriculum & Metadata Module

#### `GET /assignments/grades`
* **Mô tả**: Lấy danh sách tất cả các Khối / Lớp học.
* **Authentication**: Required (`Authorization: Bearer <token>`).
* **Response `200 OK`**:
  ```json
  {
    "message": "Get grades successfully",
    "data": [
      { "id": 1, "grade": 10 },
      { "id": 2, "grade": 11 },
      { "id": 3, "grade": 12 }
    ]
  }
  ```

#### `GET /assignments/subjects?gradeId={gradeId}`
* **Mô tả**: Lấy danh sách Môn học có bài học thuộc Khối lớp được chọn.
* **Authentication**: Required.
* **Query Parameters**: `gradeId` (number, required).
* **Response `200 OK`**:
  ```json
  [
    { "id": 1, "subject": "Toán Học" },
    { "id": 2, "subject": "Vật Lý" }
  ]
  ```

#### `GET /assignments/lessons?gradeId={gradeId}&subjectId={subjectId}`
* **Mô tả**: Lấy danh sách Bài học thuộc Lớp & Môn đã chọn.
* **Authentication**: Required.
* **Query Parameters**: `gradeId` (number), `subjectId` (number).
* **Response `200 OK`**:
  ```json
  [
    { "id": 101, "lesson_number": 1, "title": "Hàm số lượng giác" },
    { "id": 102, "lesson_number": 2, "title": "Phương trình lượng giác cơ bản" }
  ]
  ```

---

### 4.3. Assignment Management Module (CRUD)

#### `POST /assignments/create`
* **Mô tả**: Lưu thông tin bài tập (bao gồm danh sách câu hỏi & phương án) vào cơ sở dữ liệu.
* **Authentication**: Required (`req.user.id`).
* **Request Body**:
  ```json
  {
    "title": "Đề kiểm tra 1 tiết Lượng Giác",
    "description": "Đề kiểm tra chương I Toán 11",
    "class_level": "11",
    "subject": "Toán Học",
    "duration_minutes": 45,
    "lessonIds": [101, 102],
    "questions": [
      {
        "content": "Giải phương trình \\(\\sin(x) = 1\\)?",
        "question_type": "SINGLE_CHOICE",
        "cognitive_level": "NB",
        "answers": [
          { "content": "\\(x = \\frac{\\pi}{2} + k2\\pi\\)", "isCorrect": true },
          { "content": "\\(x = k\\pi\\)", "isCorrect": false }
        ]
      }
    ]
  }
  ```
* **Response `201 Created`**:
  ```json
  {
    "message": "Create assignment successfully",
    "data": {
      "id": 50,
      "title": "Đề kiểm tra 1 tiết Lượng Giác",
      "description": "Đề kiểm tra chương I Toán 11",
      "class_level": "11",
      "subject": "Toán Học",
      "duration_minutes": 45,
      "teacher_id": 1,
      "questions": [...]
    }
  }
  ```

#### `GET /assignments`
* **Mô tả**: Lấy danh sách các bài tập do Giáo viên hiện tại khởi tạo.
* **Authentication**: Required.
* **Response `200 OK`**:
  ```json
  {
    "message": "Get assignments successfully",
    "data": [
      {
        "id": 50,
        "title": "Đề kiểm tra 1 tiết Lượng Giác",
        "description": "Đề kiểm tra chương I Toán 11",
        "duration_minutes": 45,
        "teacher_id": 1,
        "subject": "Toán Học",
        "class_level": 11,
        "subject_id": 1,
        "grade_id": 2
      }
    ]
  }
  ```

#### `GET /assignments/:id`
* **Mô tả**: Xem chi tiết bài tập theo `id`.
* **Authentication**: Required.
* **Response `200 OK`**:
  ```json
  {
    "message": "Get assignment successfully",
    "data": {
      "id": 50,
      "title": "Đề kiểm tra 1 tiết Lượng Giác",
      "duration_minutes": 45,
      "teacher_id": 1,
      "subject": "Toán Học",
      "class_level": "11",
      "questions": [
        {
          "id": 201,
          "assignmentId": 50,
          "content": "Giải phương trình \\(\\sin(x) = 1\\)?",
          "question_type": "SINGLE_CHOICE",
          "answers": [
            { "id": 801, "questionId": 201, "content": "\\(x = \\frac{\\pi}{2} + k2\\pi\\)", "isCorrect": true }
          ]
        }
      ]
    }
  }
  ```

#### `PUT /assignments/edit/:id`
* **Mô tả**: Cập nhật thông tin bài tập, các câu hỏi và đáp án (tự động so sánh diff để thêm mới/sửa/xóa).
* **Authentication**: Required.
* **Request Body**:
  ```json
  {
    "title": "Đề kiểm tra 1 tiết Lượng Giác (Đã chỉnh sửa)",
    "duration_minutes": 60,
    "questions": [
      {
        "id": 201,
        "content": "Câu hỏi 1 cập nhật nội dung",
        "question_type": "SINGLE_CHOICE",
        "answers": [
          { "id": 801, "content": "Đáp án A sửa", "isCorrect": true }
        ]
      }
    ]
  }
  ```
* **Response `200 OK`**:
  ```json
  {
    "message": "Assignment updated successfully"
  }
  ```

#### `DELETE /assignments/delete/:id`
* **Mô tả**: Xóa bài tập và tất cả liên kết (câu hỏi, đáp án thuộc bài tập).
* **Authentication**: Required.
* **Response `200 OK`**:
  ```json
  {
    "message": "Assignment deleted successfully"
  }
  ```

---

### 4.4. AI Assignment Generation & PDF Import

#### `POST /ai/create`
* **Mô tả**: Tự động sinh danh sách câu hỏi bài tập dựa trên Ma trận kiến thức và nội dung các bài học được chọn qua AI Gemini.
* **Authentication**: None.
* **Request Body**:
  ```json
  {
    "data": {
      "class_level": "11",
      "subject": "Toán Học",
      "title": "Đề thi thử giữa kỳ I",
      "description": "Tự động sinh bởi Gemini AI",
      "time_duration": 45,
      "question_config": {
        "groups": [
          {
            "count": 5,
            "difficulty": "NB",
            "type": "SINGLE_CHOICE",
            "lessonIds": [101, 102]
          },
          {
            "count": 2,
            "difficulty": "VD",
            "type": "SHORT_ANSWER",
            "lessonIds": [102]
          }
        ]
      }
    }
  }
  ```
* **Response `200 OK`**:
  ```json
  {
    "message": "Assignment generated successfully",
    "data": {
      "title": "Đề thi thử giữa kỳ I",
      "description": "Tự động sinh bởi Gemini AI",
      "class_level": "11",
      "duration_minutes": 45,
      "subject": "Toán Học",
      "lessonIds": [101, 102],
      "questions": [
        {
          "content": "Tập xác định của hàm số \\(y = \\tan(x)\\) là:",
          "question_type": "SINGLE_CHOICE",
          "cognitive_level": "NB",
          "answers": [
            { "content": "\\(D = \\mathbb{R} \\setminus \\{\\frac{\\pi}{2} + k\\pi\\}\\)", "isCorrect": true },
            { "content": "\\(D = \\mathbb{R}\\)", "isCorrect": false }
          ]
        }
      ]
    }
  }
  ```

#### `POST /pdf/import`
* **Mô tả**: Đọc file PDF tải lên, trích xuất văn bản (Text layer) và sinh Đề kiểm tra tương đương thông qua Gemini AI.
* **Authentication**: None.
* **Content-Type**: `multipart/form-data`.
* **Form Field**: `pdfs` (Tối đa 5 file, mỗi file max 10MB, mimetype `application/pdf`).
* **Response `200 OK`**: Trả về `AssignmentRequest` dạng JSON chưa lưu DB để giáo viên xem trước và chỉnh sửa.

---

## 5. CLASS / MODULE DESIGN & INTERFACES GIỮA CÁC COMPONENT

### 5.1. Luồng Dữ Liệu Luân Chuyển Giữa Các Lớp (Layer Architecture Diagram)
  
```mermaid
graph TD
    Client["Client (Frontend App / Postman)"] -->|"HTTP Request / Bearer JWT"| ExpressRouter["Express Router"]
    ExpressRouter -->|"next()"| Authenticator["Middleware: Authenticator"]
    Authenticator -->|"Attach req.user"| Controller["Controller Layer"]
    Controller -->|"DTO Data"| Service["Service Layer"]
    Service -->|"Database Queries / Transactions"| Repository["Repository Layer"]
    Service -->|"Prompt + Schema"| GeminiAPI["Google Gemini 3.6 Flash API"]
    Repository -->|"Prisma Client SQL"| PostgresDB[("PostgreSQL Database")]

```

### 5.2. Các Contract Interfaces Chính Trong Hệ Thống

```typescript
// Types & DTO Definitions (src/types/assignments.ts)

export type QuestionType = "MULTIPLE_CHOICE" | "SINGLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
export type CognitiveLevel = "NB" | "TH" | "VD"; // Nhận biết | Thông hiểu | Vận dụng

export interface AnswerRequest {
  content: string;
  isCorrect: boolean;
}

export interface QuestionRequest {
  content: string;
  question_type: QuestionType;
  answers: AnswerRequest[];
  answer?: string;
  cognitive_level?: CognitiveLevel;
}

export interface AssignmentRequest {
  title: string;
  description: string;
  class_level: string;
  duration_minutes: number;
  subject: string;
  lessonIds?: number[];
  questions: QuestionRequest[];
}

// AI Ma trận kiến thức Interfaces (src/types/ai-service.ts)
export interface QuestionGroupConfig {
  topic?: string;
  count: number;
  difficulty: CognitiveLevel;
  type: QuestionType;
  lessonIds: number[];
}

export interface AiRequest {
  data: {
    class_level: string | number;
    subject: string;
    title: string;
    description?: string;
    time_duration: number;
    question_config: {
      groups: QuestionGroupConfig[];
    };
  };
}
```

### 5.3. Chiến Lược Giao Dịch Database (Database Transaction Strategy)

Tất cả các thao tác liên quan đến khởi tạo bài tập (`createWithRelations`), cập nhật bài tập (`updateWithRelations`) và xóa bài tập (`deleteWithRelations`) đều được thực thi trong một **Prisma Database Transaction** (`prisma.$transaction`) với tham số cấu hình:
- `maxWait`: 10,000 ms (thời gian tối đa chờ mở connection trong pool).
- `timeout`: 60,000 ms (thời gian tối đa thực thi chuỗi câu lệnh).
- **Rollback Guarantee**: Nếu có bất kỳ lỗi nào trong quá trình tạo/sửa các câu hỏi hoặc đáp án liên quan, toàn bộ transaction sẽ rollback để đảm bảo tính toàn vẹn dữ liệu.

---

## 6. SEQUENCE DIAGRAMS CHO TỪNG FLOW CỤ THỂ

### 6.1. Flow 1: Xác thực Người Dùng & Kiểm Tra Authorization Token (`POST /users/me/login`)

```mermaid
sequenceDiagram
    autonumber
    actor User as Giáo viên (Client)
    participant C as UserController
    participant S as UserService
    participant R as UserRepository
    participant DB as PostgreSQL
    participant JWT as JWT Library

    User->>C: POST /users/me/login { username, password }
    C->>S: UserService.login(username, password)
    S->>R: UserRepository.findByUsername(username)
    R->>DB: SELECT * FROM "User" WHERE username = ?
    DB-->>R: User Record / Null
    R-->>S: Return User Record

    alt User không tồn tại
        S-->>C: Throw Error("Invalid username or password")
        C-->>User: HTTP 500/401 { message }
    else User tồn tại
        S->>S: bcrypt.compare(password, user.password)
        alt Password Sai
            S-->>C: Throw Error("Invalid username or password")
            C-->>User: HTTP 500/401 { message }
        else Password Đúng
            S->>JWT: jwt.sign({ id, username, role }, JWT_SECRET, { expiresIn: '1d' })
            JWT-->>S: Return Access Token
            S-->>C: { accessToken, user }
            C-->>User: HTTP 200 OK { accessToken, user }
        end
    end
```

---

### 6.2. Flow 2: Sinh Đề Thi Tự Động Bằng AI Gemini Dựa Trên Ma Trận Kiến Thức (`POST /ai/create`)

```mermaid
sequenceDiagram
    autonumber
    actor User as Client / Giáo viên
    participant C as AiController
    participant S as AiService
    participant R as LessonRepository
    participant DB as PostgreSQL
    participant G as Gemini API (3.6 Flash)

    User->>C: POST /ai/create (Nạp Ma trận & lessonIds)
    C->>S: AiService.create(demand)
    S->>S: Trích xuất danh sách unique `allLessonIds` từ các group
    S->>R: LessonRepository.findContentsByIds(allLessonIds)
    R->>DB: SELECT id, lesson_number, title, content FROM "Lessons" WHERE id IN (...)
    DB-->>R: Return danh sách nội dung bài học
    R-->>S: Return Lessons Content Data

    S->>S: Ghép Prompt chi tiết (Yêu cầu định dạng LaTeX, cấu trúc Group & Cognitive level)
    S->>G: generateContent({ model: 'gemini-3.6-flash', contents: prompt, schema: assignmentAiSchema })
    G-->>S: Trả về JSON String đúng cấu trúc Schema (Structured Output)
    S->>S: Parse & Normalize Level (NB, TH, VD)
    S-->>C: Trả về Object AssignmentRequest
    C-->>User: HTTP 200 OK { message, data: assignment }
```

---

### 6.3. Flow 3: Import File PDF Đề Mẫu & AI Sinh Đề Tương Đương (`POST /pdf/import`)

```mermaid
sequenceDiagram
    autonumber
    actor User as Client
    participant M as Multer Middleware
    participant C as PdfImportController
    participant P as pdf-parse Engine
    participant S as PdfImportService
    participant G as Gemini API (3.6 Flash)

    User->>M: POST /pdf/import (Multipart Form-Data: pdfs[])
    M->>M: Validate số file (<=5), dung lượng (<=10MB), Mimetype (application/pdf)
    alt Lỗi Upload File
        M-->>User: HTTP 400 Bad Request (Lỗi định dạng file)
    else File hợp lệ
        M->>C: Forward req.files (Buffer RAM)
        loop Với từng file PDF
            C->>P: extractPdfText(file.buffer)
            P-->>C: Trả về chuỗi text trích xuất
            C->>C: Check text layer không rỗng (chống scan ảnh)
        end
        C->>S: PdfImportService.generateFromPdfs({ files: parsedFiles })
        S->>S: Dựng System Prompt yêu cầu phân tích cấu trúc, chủ đề & sinh đề mới bằng LaTeX
        S->>G: generateContent({ model: 'gemini-3.6-flash', contents: prompt, schema: assignmentAiSchema })
        G-->>S: Trả về JSON Struct Đề thi mới
        S-->>C: Trả về Object AssignmentRequest
        C-->>User: HTTP 200 OK { message, data: assignment }
    end
```

---

### 6.4. Flow 4: Lưu Bài Tập Vào Database (`POST /assignments/create`)

```mermaid
sequenceDiagram
    autonumber
    actor User as Giáo viên
    participant Auth as Authenticator Middleware
    participant C as AssignmentController
    participant S as AssignmentService
    participant R as AssignmentRepository
    participant DB as PostgreSQL Transaction

    User->>Auth: POST /assignments/create (Bearer JWT + Payload Đề thi)
    Auth->>Auth: Verify JWT Token Token -> req.user
    Auth->>C: Pass control
    C->>S: AssignmentService.create(assignmentReq, teacherId)
    S->>R: AssignmentRepository.createWithRelations(assignmentReq, teacherId)
    
    rect rgb(240, 248, 255)
        note over R, DB: Mở Transaction Client (prisma.$transaction)
        R->>DB: INSERT INTO "Assignment" (title, description, duration, teacher_id)
        DB-->>R: Created Assignment (assignment_id)
        R->>DB: INSERT INTO "Lesson_Assignment" (assignment_id, lesson_id)
        loop Với từng câu hỏi trong questions[]
            R->>DB: INSERT INTO "Question" (content, question_type, answer)
            DB-->>R: Created Question (question_id)
            R->>DB: INSERT INTO "Assignment_Question" (assignment_id, question_id)
            R->>DB: INSERT INTO "Question_Options" (question_id, content, is_correct)
        end
    end

    DB-->>R: Commit Transaction thành công
    R-->>S: Trả về Assignment + Questions
    S-->>C: Map dữ liệu trả về DTO
    C-->>User: HTTP 201 Created { message, data: assignment }
```

---

### 6.5. Flow 5: Cập Nhật Bài Tập & Đồng Bộ Câu Hỏi (`PUT /assignments/edit/:id`)

```mermaid
sequenceDiagram
    autonumber
    actor User as Giáo viên
    participant C as AssignmentController
    participant S as AssignmentService
    participant R as AssignmentRepository
    participant DB as PostgreSQL Transaction

    User->>C: PUT /assignments/edit/:id (Header Bearer Token + Update Body)
    C->>S: AssignmentService.updateAssignment(id, teacherId, data)
    S->>R: AssignmentRepository.updateWithRelations(id, teacherId, data)

    rect rgb(255, 245, 238)
        note over R, DB: Mở Transaction Client (prisma.$transaction)
        R->>DB: SELECT FROM "Assignment" WHERE id = assignmentId AND teacher_id = teacherId
        alt Không tìm thấy hoặc Không có quyền
            DB-->>R: Null
            R-->>S: Throw Error("Assignment not found or permission denied")
        else Hợp lệ
            R->>DB: UPDATE "Assignment" SET title, description, duration...
            R->>DB: DELETE FROM "Lesson_Assignment" & Re-create mới
            
            note over R, DB: Xử lý Diffing danh sách Question & Option
            loop Với các câu hỏi trong Request
                alt Câu hỏi có id cũ
                    R->>DB: UPDATE "Question" SET content, type...
                else Câu hỏi mới
                    R->>DB: INSERT INTO "Question" & "Assignment_Question"
                end
                R->>DB: Upsert / Delete các "Question_Options" tương ứng
            end
            R->>DB: DELETE các Câu hỏi cũ không còn trong Request
        end
    end

    DB-->>R: Commit Transaction
    R-->>S: Done
    S-->>C: Done
    C-->>User: HTTP 200 OK { message: "Assignment updated successfully" }
```

---

### 6.6. Flow 6: Xóa Bài Tập (`DELETE /assignments/delete/:id`)

```mermaid
sequenceDiagram
    autonumber
    actor User as Giáo viên
    participant C as AssignmentController
    participant S as AssignmentService
    participant R as AssignmentRepository
    participant DB as PostgreSQL Transaction

    User->>C: DELETE /assignments/delete/:id (Bearer JWT)
    C->>S: AssignmentService.deleteById(assignmentId, teacherId)
    S->>R: AssignmentRepository.deleteWithRelations(assignmentId, teacherId)

    rect rgb(255, 240, 240)
        note over R, DB: Mở Transaction Client (prisma.$transaction)
        R->>DB: CHECK "Assignment" tồn tại & thuộc về teacherId
        R->>DB: SELECT tất cả question_ids từ "Assignment_Question"
        R->>DB: DELETE FROM "Assignment_Question" WHERE assignment_id = id
        R->>DB: DELETE FROM "Lesson_Assignment" WHERE assignment_id = id
        R->>DB: DELETE FROM "Question_Options" WHERE question_id IN (question_ids)
        R->>DB: DELETE FROM "Question" WHERE id IN (question_ids)
        R->>DB: DELETE FROM "Assignment" WHERE id = id
    end

    DB-->>R: Commit Transaction
    R-->>S: Done
    S-->>C: Done
    C-->>User: HTTP 200 OK { message: "Assignment deleted successfully" }
```

---


