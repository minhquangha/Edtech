import multer from "multer";
const storage = multer.memoryStorage();//Dữ liệu upload sẽ lưu trữ vào RAM

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, //tổng file upload tối đa là 10 MB
    files: 5, // số file dc upload tối đa là 5
  },
  fileFilter: (_req, file, cb) => {// hàm này dc chạy mỗi khi 1 file dc upload lên,file là file dg dc upload tại thời điểm 
                                   // hàm này chạy ,cb là callback,nó giúp xử lí và quyết định file này có dc upload 
                                   // hay k
    if (file.mimetype !== "application/pdf") {
      cb(new Error("Only PDF files are allowed"));
      return;
    }// báo lỗi cho Multer.
    cb(null, true); //chấp nhận upload file này
  },
});
export default upload;