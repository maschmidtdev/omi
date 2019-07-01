$(document).ready(function(){


// Auto-focus on the username input
$('#user').focus();


var socket = io();
// ========== Socket functions ===========



// ========== jQuery ===========
$("#reset").on("click", function() {
  $('label').removeClass('active');
  //$('#user').focus();
});





});
