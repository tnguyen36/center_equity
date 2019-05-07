var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");

var UserSchema = new mongoose.Schema({
	firstName: String,
	lastName: String,
	username: String,
	rank: String,
	reason: String,
	password: String,
	subscribe: String
});

UserSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", UserSchema);