var mongoose = require("mongoose");

var reasonSchema = new mongoose.Schema({
	text: String,
	author: {
		id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User"
		},
		username: String
	},
	time: Date
});

module.exports = mongoose.model("Reason", reasonSchema);