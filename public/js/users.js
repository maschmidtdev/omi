$(document).ready(function() {

var socket = io();
var user = $('#user').text(); // Get logged-in user

socket.emit('get_ad_user_object', {user: user}); // Request the AD User Object in JSON format
socket.emit('get_db_users');
// ========== Socket handling ===========

// Receive the AD User Object and populate DOM elements with data
socket.on('ad_user_object', (data) => {
  console.log(data.userObject);
  $('#givenName').text('Hallo ' + data.userObject["givenName"] + ', du bist ein Admin! Cool!');
  $('#userObject').text(data.userObject["dn"]);
  $('#userObjectString').text(data.userObjectString);
});

socket.on('db_users', (data) => {
  data.users.forEach((user) => {
    $('#user-list').append('<li id="user_'+user.username+'" class="collection-item"><div>'
      + user.username + ' | ' + user.role + ' | ' + user.email
      + '<a name="'+user.username+'" class="secondary-content delete"><i class="material-icons red-text">delete_forever</i></a><a class="secondary-content"><i class="material-icons">edit</i></a></div></li>');
  });

  $('.delete').click( (element) => {
    var name = element.currentTarget.attributes.name.nodeValue;

    if(confirm('User ' + name + ' wirklich löschen?')){
      socket.emit('db_delete_user', {username: name});
    } else {
      alert('false');
    }
  });

});

socket.on('db_roles', (data) => {
  data.result.forEach((role) => {
    $('#dropdown_roles').append('<li><a class="dropdown-item">'+role.role_name+'</a></li>');
  });

  $('.dropdown-trigger').dropdown();
  $('.dropdown-item').on('click', (element) => {
    $('#new_user_role').val(element.target.innerText);
  });

});

socket.on('alertmessage', (data) => {
  alert(data.msg);
});

socket.on('ldap_user_search_result', (data) => {
  alert(JSON.stringify(data.object, undefined, 1));
});

// User added, update view
socket.on('db_user_added', () => {
  updateUserList();
});

// User deleted, update view
socket.on('db_user_deleted', () => {
  updateUserList();
});


// ========== jQuery ===========

$('#scaleNewUserForm').click( () => {

  $('#newUserForm').removeClass('scale-out');

  // Check if the user form already exists
  if ( $('#userFormDiv').children().length > 0 ) {

    removeUserForm();

  } else {
    // Add the list for roles dropdown
    $("body").prepend('<ul id="dropdown_roles" class="dropdown-content"></ul>');
    // Pull roles from db to populate role dropdown
    socket.emit('get_db_roles');
    // Add user form and scale in
    $('#userFormDiv').append('<form class="col s12 scale-transition scale-out" id="newUserForm">'
                              + '<div class="row">'
                                + '<div class="input-field col s6">'
                                  + '<input type="text" class="validate" id="first_name">'
                                  + '<label for="first_name">Vorname</label>'
                                + '</div>'
                                + '<div class="input-field col s6">'
                                  + '<input type="text" class="validate" id="last_name">'
                                  + '<label for="last_name">Nachname</label>'
                                + '</div>'
                              + '</div>'
                              + '<div class="row">'
                                // + '<div class="input-field col s7">'
                                //   + '<input type="email" class="validate" id="new_user_email">'
                                //   + '<label for="new_user_email">Email</label>'
                                // + '</div>'
                                + '<div class="input-field col s5">'
                                  + '<input type="text" class="validate dropdown-trigger" data-target="dropdown_roles" id="new_user_role">'
                                  + '<label for="new_user_role">Role</label>'
                                + '</div>'
                                + '<div class="input-field col s2">'
                                  + '<a id="add_new_user" class="btn">Add User</a>'
                                + '</div>'
                              + '</div>'
                            + '</form>');

    // Give time for fade-in
    setTimeout(() => {
      $('#newUserForm').removeClass('scale-out');
      $('.dropdown-trigger').dropdown();
    }, 30);

    $('#add_new_user').click( () => {
      var first_name = $('#first_name').val();
      var last_name = $('#last_name').val();
      var new_user_role = $('#new_user_role').val();

      socket.emit('ldap_new_user_check', {username: (first_name+last_name).toLowerCase(), role: new_user_role});

    });

    $('#scaleNewUserForm').find(':first-child').text('remove');

  }

});

// ========== Functions ===========

updateUserList = function(){
  removeUserForm();
  $('#user-list li').not(':first').remove();
  socket.emit('get_db_users');
}

removeUserForm = function(){
  // Scale out and remove user form
  setTimeout(() => {
    $('#userFormDiv').find(':first-child').remove();
  }, 150);
  $('#scaleNewUserForm').find(':first-child').text('add');
  $('#newUserForm').addClass('scale-out');
}


});
