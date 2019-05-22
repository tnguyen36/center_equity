var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");
var Reason = require("./reason");

var UserSchema = new mongoose.Schema({
	firstName: String,
	lastName: String,
	username: {type: String, unique: true},
	rank: String,
	password: String,
	subscribe: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    userSince: Date,
    lastLogin: Date,
    reasons: [
    	{
    		type: mongoose.Schema.Types.ObjectId,
			ref: "Reason"
    	}
    ]
});


UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", UserSchema);