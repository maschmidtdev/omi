$(document).ready(function() {

$('#nav_users').addClass('active'); // Show we're on the users page

var socket = io();
var user = $('#user').text(); // Get logged-in user
var users = null; // AD users, becomes array

socket.emit('get_ad_user_object', {user: user}); // Request the AD User Object in JSON format
socket.emit('get_db_users');

// Pull roles from db to populate role dropdown
socket.emit('get_db_roles');

// ========== Socket handling ===========
socket.on('alertmessage', (data) => {
  alert(data.msg);
});
socket.on('ldap_user_search_result', (data) => {
  alert(JSON.stringify(data.object, undefined, 1));
});

// Receive the AD User Object and populate DOM elements with data
socket.on('ad_user_object', (data) => {

  // First call of ad_user_object
  if(users === null){
    // Mark 'users' as array to fill with ad users
    users = [];

    $('#givenName').text('Hallo ' + data.userObject["givenName"] + ', du bist ein Admin! Cool!');
    $('#userObject').text(data.userObject["dn"]);
    $('#userObjectString').text(data.userObjectString);

  // Subsequent calls to populate user list with ad user objects
  } else {
    users[data.username] = [];
    users[data.username].push(data.userObject);
  }
});

// Populate ul/collection with database users
socket.on('db_users', (data) => {

  data.users.forEach((user) => {
    // Request the ad object for the user to save in the users array
    socket.emit('get_ad_user_object', {user: user.username});
    var username = user.username;
    var role = user.role;
    var email = user.email;

    // Append user data to the collection
    $('#user-list').append('<li id="user_'+username+'" class="collection-item">'
                            + '<div>'+ username + ' | ' + role + ' | ' + email
                              + '<a id="delete_'+username+'" name="'+username+'" class="secondary-content delete">'
                                + '<i class="material-icons red-text">delete_forever</i>'
                              + '</a>'
                              + '<a id="edit_'+username+'" name="'+username+'" class="secondary-content edit-user">'
                                + '<i class="material-icons">edit</i>'
                              + '</a>'
                              + '<a id="show_'+username+'" name="'+username+'" class="secondary-content show-user">'
                                + '<i class="material-icons">add</i>'
                              + '</a>'
                            + '</div>'
                          + '</li>');
  });


  // Click on + icon
  expandUser();
  // Click on delete icon
  deleteUser();

});

// Populate dropdown-ul with user roles
socket.on('db_roles', (data) => {
  data.result.forEach((role) => {
    $('#dropdown_roles').append('<li><a class="dropdown-item">'+role.role_name+'</a></li>');
  });

  $('.dropdown-trigger').dropdown();
  $('.dropdown-item').on('click', (event) => {
    $('#new_user_role').val(event.target.innerText);
  });

});

// User added, update view
socket.on('db_user_added', () => {
  // Clear all inputs
  $('input').val('');
  updateUserList();
});

// User deleted, update view
socket.on('db_user_deleted', () => {
  updateUserList();
});


// ========== jQuery ===========

$('#add_new_user').click( () => {
    var first_name = $('#first_name').val();
    var last_name = $('#last_name').val();
    var new_user_role = $('#new_user_role').val();

    socket.emit('ldap_new_user_check', {first_name: first_name.toLowerCase(), last_name: last_name.toLowerCase(), role: new_user_role});
  });

$('#scaleNewUserForm').click( () => {

  // If form is invisible
  if ( $('#userFormDiv').hasClass("display-none") ){
    // Make form visible
    $('#userFormDiv').removeClass('display-none');
    // Give time for fade-in
    setTimeout(() => {
      $('#newUserForm').removeClass('scale-out');
      $('.dropdown-trigger').dropdown();
    }, 30);
    // Change icon to -
    $('#scaleNewUserForm').find(':first-child').text('remove');
  } else {
    // Else hide the form
    removeUserForm();
  }

});

    // ---- jQuery wrapper for better maintainability ----

// Expand user information
expandUser = function(){
  $('.show-user').click( (event) => {

    var username = $(event.currentTarget).attr("name");
    var user = users[username][0]; // This is the AD object

    // Delete user details from DOM if exists, else append the information to the corresponding li element
    if($('#userdata_'+username).length != 0){

      $('#show_'+username).find(':first-child').text('add');
      $('#userdata_'+username).remove();

    } else {

      $('#show_'+username).find(':first-child').text('remove');

      // Gather relevant information
      var first_name = user.givenName;
      var last_name = user.sn;

      // Email Adresse
      var email = '';
      if(user.proxyAddresses !== undefined){
        email = user.mail.toLowerCase();
      }
      // Telefonnummer
      var phone = '';
      if(user.telephoneNumber !== undefined){
        phone = user.telephoneNumber;
      }
      // Position
      var position = '';
      if(user.description !== undefined){
        position = user.description;
      }
      // Gruppen
      var gruppen = '';
      if(user.memberOf !== undefined){
        gruppen = user.memberOf;

        gruppen.forEach((g) => {
          console.log(g);
        });
      }

      socket.emit('ldap_groups');

      // Append AD user information to collection item
      $('#user_'+username).append('<div id="userdata_'+username+'">'
                                  + '<div class="row no-margin" >'
                                    + '<span class="thick col s3">Name: </span><span class="col s9">'+first_name+' '+last_name+'</span>'
                                  + '</div>'
                                  + '<div class="row no-margin" >'
                                    + '<span class="thick col s3">Position: </span><span class="col s9">'+position+'</span>'
                                  + '</div>'
                                  + '<div class="row no-margin" >'
                                    + '<span class="thick col s3">Telefon: </span><span class="col s9">'+phone+'</span>'
                                  + '</div>'
                                  + '<div class="row no-margin" >'
                                    + '<span class="thick col s3">E-mail: </span><span class="col s9">'+email+'</span>'
                                  + '</div>'
                                  + '<div class="row no-margin" >'
                                    + '<span class="thick col s12">Gruppen:</span>'
                                  + '</div>'
                                  + '<div class="row no-margin ad-user-groups" id="groups_'+username+'" >'
                                  + '</div>'
                                + '</div>');


      gruppen.forEach((g) => {
        // $("#groups_"+username).append(g);
        // $("#groups_"+username).append('<div class="ad-group col s12">'+g+'</div>');
        $("#groups_"+username).append('<div class="ad-user-group col s12">'+g+'</div>');
        // $("#groups_"+username).append('<span>'+g+'</span>');
      });

      // console.log(user);
    }
  });
}
// Delete a User from DB
deleteUser = function(){
  $('.delete').click( (event) => {
    var name = $(event.currentTarget).attr("name");

    if(confirm('User ' + name + ' wirklich löschen?')){
      socket.emit('db_delete_user', {username: name});
    } else {
      //
    }
  });
}

//

// ========== Functions ===========

updateUserList = function(){
  removeUserForm();
  // Clear list from users
  $('#user-list li').not(':first').remove();
  // Then get users again
  socket.emit('get_db_users');
}

removeUserForm = function(){

  // Change icon to +
  $('#scaleNewUserForm').find(':first-child').text('add');
  $('#newUserForm').addClass('scale-out');
  // Give time for scale-out
  setTimeout(() => {
    $('#userFormDiv').addClass("display-none");
  }, 150);
}


});
