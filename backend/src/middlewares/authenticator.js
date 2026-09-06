import jwt from "jsonwebtoken";
const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({
                message: "Authentication required",
            });
        }
        const token = authHeader.split(" ")[1];
        if (!token) {
            return res.status(401).json({
                message: "Invalid authorization header",
            });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (error) {
        console.log(error);
        return res.status(401).json({
            message: "Invalid or expired token",
        });
    }
};
export default authenticate;
//# sourceMappingURL=authenticator.js.map