var User = require("../models/user");


var middlewareObj = {};

middlewareObj.isAdmin = function(req, res, next) {
	if(req.isAuthenticated()) {
		if (req.user.rank === "Admin") {
			next();
		} else {
			req.flash("error", "Only Admins can access this page");
			res.redirect("back");
		}
	} else {
		req.flash("error", "You need to be logged in to access this page");
		res.redirect("back");
	}
}

module.exports = middlewareObj;