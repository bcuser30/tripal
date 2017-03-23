/**
 * @file
 * TripalUploader Object
 * 
 * To use the TripalUploader Object the following must be performed:
 * 
 * 1) Add a Drupal form to your code that contains the following:
 *   * A Drupal-style table with 4 or 8 columns.  See the addUploadTable
 *     function in this class for a description of the columns.
 *   * A button for submitting a file for upload.
 * 
 * @code
 * $headers = array(
 *    array('data' => 'Sequence File'),
 *    array('data' => 'Size', 'width' => '10%'),
 *    array('data' => 'Upload Progress', 'width' => '20%'),
 *    array('data' => 'Action', 'width' => '10%')
 *  );
 *  $rows = array();
 *  $table_vars = array(
 *    'header'      => $headers,
 *    'rows'        => $rows,
 *    'attributes'  => array('id' => 'sequence-file-upload-table'),
 *    'sticky'      => TRUE,
 *    'colgroups'   => array(),
 *    'empty'       => t('There are currently no files added.'),
 *  );
 *  $form['upload']['sequence_file'] = array(
 *    '#markup' => theme('table', $table_vars)
 *  );
 *  $form['upload']['sequence_fid'] = array(
 *    '#type' => 'hidden',
 *    '#value' => 0,
 *    '#attributes' => array('id' => 'sequence-fid')
 *  );
 *  $form['upload']['sequence_file_submit'] = array(
 *    '#type'     => 'submit',
 *    '#value'    => 'Upload Sequence File',
 *    '#name' => 'sequence_file_submit',
 *    // We don't want this button to submit as the file upload
 *    // is handled by the JavaScript code.
 *    '#attributes' => array('onclick' => 'return (false);')
 *  );
 * @endcode
 * 
 * 
 * 2)  Edit the theme/js/[module_name].js and in the "Drupal.behaviors.[module]" 
 * section add a JQuery show function to the form that converts the table 
 * created in the Drupal form to a TripalUploader table.  The 'table_id' must be
 * the same as the 'id' attribute set for the table in the Drupal code above.
 * The 'submit_id' must be the id of the upload button added in the Drupal
 * code above.  The 'category' for the files.  This is the category that
 * will be saved in Tripal for the file.  See the addUploadTable function
 * for additional options.  Include a 'cardinality' setting to indicate
 * the number of allowed files per upload, and set the 'target_id' to the
 * name of the field that will contain the file ID (fid) after uploading.
 * 
 * @code
 *  // The TripalUploader object used for uploading of files using the
 *  // HTML5 File API. Large files are uploaded as chunks and a progress
 *  // bar is provided.
 *  var uploader = new TripalUploader();
 *  
 *  $('#tripal-sequences-panel-form').show(function() {
 *    uploader.addUploadTable('sequence_file', {
 *      'table_id' : '#sequence-file-upload-table',
 *      'submit_id': '#edit-sequence-file-submit',
 *      'category' : ['sequence_file'],
 *      'cardinality' : 1,
 *      'target_id' : 'sequence-fid',
 *    });
 *  });
 * @endcode
 *
 *
 * 3) Files are uploaded automatically to Tripal.  Files are saved in the
 * Tripal user's directory.  You can retreive information about the 
 * file by querying for the file category for the current project.
 * 
 * @code
 *   $seq_files = TripalFeature::getFilesByTypes($user->uid, array('sequence_file'), $project_id);
 * @endcode
 * 
 * 4) If the 'target_id' was used in array for step #2 above, then the 
 * file ID can be retrieved in the hook_validate() and hook_submit() functions
 * via the $form_state['input'] array (not the $form_state['values'] array.
 */


(function($) {

  "use strict";
  
  /**
   * The constructor function.
   */
  var TripalUploader = function() {

    // Holds the list of files and organizes them by category and then
    // by an index number.
    this.files = {};
    
    // The tables array will have the following keys:
    //
    // tname: the name of the HTML table containing the file.
    // category:  the category within the table to which the file belongs.
    // index:  the index of the file in the table.
    // url: The URL at the remote server where the file will uploaded.
    this.tables = {};

    /**
     * Adds a file to the TripalUploader object
     * 
     * @param file
     *   The HTML5 file object.
     * @param options
     *   A set of key value pairs of the following
     *     - tname: the name of the HTML table containing the file.
     *     - category:  the category within the table to which the file belongs.
     *     - index:  the index of the file in the table.
     *     - url: The URL at the remote server where the file will uploaded.
     */
    this.addFile = function(file, options) {
      var tname = options['tname'];
      var category = options['category'];
      var i = options['i'];
      var url = options['url'];
      var self = this;
      
      if (!(category in this.files)) {
        this.files[category] = {}
      }      
      var options = {
        'parent' : self,
        'index' : i,
        'url' : url,
        'category' : category,
        'tname' : tname,
        'progress' : category + '-progress-' + i,
        'links' : category + '-links-' + i,
        'module' : this.tables[tname]['module']
      }
      var guf = new TripalUploadFile(file, options)
      this.files[category][i] = guf;
      return guf
    };
    /**
     * 
     */
    this.removeFile = function(category, i) {
      if (category in this.files) {
        if (i in this.files[category]) {
          delete this.files[category][i];
        }
      }
    }
    /**
     * 
     */
    this.getMaxIndex = function(category) {
      var index = 0;
      if (category in this.files) {
        for (var i in this.files[category]) {
          if (i > index) {
            index = i;
          }
        }
      }
      return index;
    }
    /**
     * 
     */
    this.getNumFiles = function(category) {
      var count = 0;
      if (category in this.files) {
        for (var i in this.files[category]) {
          count = count + 1;
        }
      }
      return count;
    }
    /**
     * 
     */
    this.getCategoryFiles = function(category) {
      if (!(category in this.files)) {
        return [];
      }
      return this.files[category];
    };
    /**
     * 
     */
    this.cancelFile = function(category, i) {
      if (category in this.files) {
        this.files[category][i].cancel();
      }
    };
    /**
     * 
     */
    this.start = function(category) {
      if (category in this.files) {
        for (var i in this.files[category]) {
          this.files[category][i].start();
        }
      }
    };
    /**
     * 
     */
    this.updateProgress = function(category) {
      if (category in this.files) {
        for (var i in this.files[category]) {
          this.files[category][i].updateStatus();
        }
      }
    };
    /**
     * 
     */
    this.reset = function(category) {
      if (category in this.files) {
        for (i in this.files[category]) {
           this.files[category][i].cancel();
        }
        this.files[category] = [];
      }
    }
    
    /**
     * 
     */
    this.getFileButton = function(tname, category, i) {
      var button_name = tname + '--' + category + '-upload-' + i;
      var element = '<input id="' + button_name + '" class="tripal-chunked-file-upload" type="file">';
      
      return {
        'name' : button_name,
        'element' : element,
      }
    }
    
    /**
     * 
     */
    this.parseButtonID = function(id) {
      // Get the category and index for this file.
      var tname = id.replace(/^(.+)--(.+)-upload-(.+)$/, '$1');
      var category = id.replace(/^(.+)--(.+)-upload-(.+)$/, '$2');
      var index = id.replace(/^(.+)--(.+)-upload-(.+)$/, '$3');
      
      return {
       'tname' : tname,
       'category' :  category, 
       'index' : index
      };
    }
    
    /**
     * Adds support for an upload table for a specific category.
     * 
     * The TripalUploader supports two types of tables, a table for
     * uploading paired data (e.g. RNA-seq) and single files.  This function
     * replaces the body of an existing table as new files and updates
     * the table as files are uploaded.
     * 
     * @param tname
     *   The name of the table. For single files it is best to name the
     *   table the same as the file category.  For paired data it is best
     *   to use a name that represents both categoires.
     * @param options
     *   An associative array that contains the following keys:
     *   table_id: The HTML id of the table.  For single data, the table
     *     must already have 4 columns with headers (file name,
     *     size, progress and action). For paired data, the table
     *     must already have 8 columns, which are the same as the
     *     single table but with two sets.
     *   category:  An array. It must contain the list of categories that
     *     this table manages.  For paired data include two categories.
     *     This is the category of the file when saved in Tripal.
     *   submit_id: The HTML id of the submit button.
     *   module: The name of the module managing the table.
     *   cardinatily:  (optional) The number of files allowed.  Set to 0 for 
     *     unlimited.  Defalt is 0.
     *   target_id: (optional). The HTML id of the hidden field in the form 
     *     where the file ID will be written to this field. This only 
     *     works if cardinality is set to 1.
     *   allowed_types: (optional). An array of allowed file extensions (e.g.
     *     fasta, fastq, fna, gff3, etc.). 
     */
    this.addUploadTable = function(tname, options) {
      var table_id = options['table_id'];
      var categories = options['category'];
      var submit_id = options['submit_id'];
      var target_id = options['target_id'];
      var cardinality = options['cardinality'];
      var module = options['module'];
      
      // Save the table ID for this category
      if (!(tname in this.tables)) {
        this.tables[tname] = {};
      }
      this.tables[tname]['table_id'] = table_id;
      this.tables[tname]['category'] = categories;
      this.tables[tname]['submit_id'] = submit_id;
      this.tables[tname]['target_id'] = target_id;
      this.tables[tname]['cardinality'] = cardinality;
      this.tables[tname]['module'] = module;
      this.updateTable(categories[0]);
      this.enableSubmit(submit_id);
    }
    
    /**
     * Adds a click event to the submit button that starts the upload.
     */
    this.enableSubmit = function(submit_id) {
      var self = this;
      var categories = [];
      
      // Iterate through all of the tables that use this submit button
      // and collect all the categories.  We want to update them all.
      for (var tname in this.tables) {
        if (this.tables[tname]['submit_id'] == submit_id){
          for (var i = 0; i < this.tables[tname]['category'].length; i++) {
            categories.push(this.tables[tname]['category'][i])
          } 
        }
      }
      var func_name = ($.isFunction($.fn.live)) ? 'live' : 'on';
      $(submit_id)[func_name]('click', function() {
        for(var i = 0; i < categories.length; i++) {
          self.start(categories[i]);
        }
      });
    }
    
    /**
     * Updates the table for the given file category.
     */
    this.updateTable = function(category) {
      // Iterate through all of the tables that are managed by this object.
      for (var tname in this.tables) {
        // Iterate through all of the categories on each table.
        for (var i = 0; i < this.tables[tname]['category'].length; i++) {
          // If the category of the table matches then update it.
          if (this.tables[tname]['category'][i] == category) {
            // For single files:
            if (this.tables[tname]['category'].length == 1) {
              var cat = this.tables[tname]['category'][0];
              this.updateSingleTable(tname, cat);
              this.updateProgress(cat);
              return;
            }
            // For paired (e.g. RNA-seq) files:
            if (this.tables[tname]['category'].length == 2) {
              var categories = this.tables[tname]['category'];
              this.updatePairedTable(tname, categories);
              this.updateProgress(categories[0]);
              this.updateProgress(categories[1]);
              return;
            }
          }
        }
      }
    }

    /**
     * A table for non-paired single data.
     */
    this.updateSingleTable = function(tname, category) {
      var i = 0;
      var content = '';
      var files  = this.getCategoryFiles(category);
      var max_index = this.getMaxIndex(category);
      var has_file = false;
      var table_id = this.tables[tname]['table_id'];
      var cardinality = this.tables[tname]['cardinality'];
      var target_id = this.tables[tname]['target_id'];
      var num_files = this.getNumFiles(category);
      var button = null;

      // Build the rows for the non paired samples.
      has_file = false;
      for (i = 0; i <= max_index; i++) {
        button = this.getFileButton(tname, category, i);
        var trclass = 'odd';
        if (i % 2 == 0) {
          trclass = 'even';
        }
        content += '<tr class="' + trclass + '">';
        if (i in files) {
          content += '<td>' + files[i].file.name + '</td>';
          content += '<td>' + files[i].getFileSize(true) + '</td>';
          content += '<td>' + files[i].getProgressBar() + '</td>';
          content += '<td>' + files[i].getLinks() + '</td>';
          content += '</tr>';
          has_file = true;
        }
        else {
          content += '<td colspan="4">' + button['element'] + '</td>';
        }
        content +=  '</tr>';
      }

      // Create an empty row with a file button.
      if (has_file) {
        // Only add a new row if we haven't reached our cardinality limit.
        if (!cardinality || cardinality == 0 || cardinality < num_files) {
          button = this.getFileButton(tname, category, i);
          content += '<tr><td colspan="4">' + button['element'] + '</td></tr>';
        }
      }

      // Add the body of the table to the table with the provided table_id.
      $(table_id + ' > tbody').html(content);
      if (button) {
        this.enableFileButton(button['name']);
      }
    }

    /**
     * Sets the table's target field with the file id.
     * 
     * @param $file_id
     *   The Tripal file_id
     * @param $tname
     *   The name of the HTML table where the file is kept.
     * @param $category
     *   The name of the category to which the file belongs.
     */
    this.setTarget = function(file_id, tname, category) {
      var files  = this.getCategoryFiles(category);
      var cardinality = this.tables[tname]['cardinality'];
      var target_id = this.tables[tname]['target_id'];
      var num_files = this.getNumFiles(category);
         
      // If cardinality is 1 and this is a single file and we have a
      // target, then we want to save the file id in the hidden field target 
      // value
      if (cardinality && cardinality == 1 && target_id && num_files == 1) {
        $('#' + target_id).val(files[0].file_id);
      }
    }

    /**
     * A table for paired data (e.g. RNA-seq).
     */
    this.updatePairedTable = function(tname, categories) {
        var i = 0;
        var table_id = this.tables[tname]['table_id'];
        var cardinality = this.tables[tname]['cardinality'];

        var category1 = categories[0];
        var category2 = categories[1];

        var paired_content = '';   
        var category1_files = this.getCategoryFiles(category1);
        var category2_files = this.getCategoryFiles(category2);    
        var max_paired1 = this.getMaxIndex(category1);
        var max_paired2 = this.getMaxIndex(category2);
        
        var button1 = null;
        var button2 = null;

        // Bulid the rows for the paired sample files table.
        var has_file = false;
        for (i = 0; i <= Math.max(max_paired1, max_paired2); i++) {
          button1 = this.getFileButton(tname, category1, i);
          button2 = this.getFileButton(tname, category2, i);

          var trclass = 'odd';
          if (i % 2 == 0) {
            trclass = 'even';
          }
          paired_content +=  '<tr class="' + trclass + '">';
          if (i in category1_files) {
            paired_content += '<td>' + category1_files[i].getFileName() + '</td>';
            paired_content += '<td>' + category1_files[i].getFileSize(true)  + '</td>';
            paired_content += '<td>' + category1_files[i].getProgressBar() + '</td>';
            paired_content += '<td>' + category1_files[i].getLinks() + '</td>';
            has_file = true;
          }
          else {
            paired_content += '<td colspan="4">' + button1['element'] + '</td>';
          }
          if (i in category2_files) {
            paired_content += '<td>' + category2_files[i].getFileName() + '</td>';
            paired_content += '<td>' + category2_files[i].getFileSize(true) + '</td>';
            paired_content += '<td>' + category2_files[i].getProgressBar() + '</td>';
            paired_content += '<td nowrap>' + category2_files[i].getLinks() + '</td>';
            has_file = true;
          }
          else {
            paired_content += '<td colspan="4">' + button2['element'] + '</td>';
          }
          paired_content +=  '</tr>';
        }

        // Create a new empty row of buttons if we have files.
        if (has_file) {
          // Only add a new row if we haven't reached our cardinality limit.
          if (!cardinality || cardinality == 0 || cardinality < max_index) {
            button1 = this.getFileButton(tname, category1, i);
            button2 = this.getFileButton(tname, category2, i);
            paired_content += '<tr class="odd"><td colspan="4">' + button1['element'] + 
              '</td><td colspan="4">' + button2['element'] + '</td></tr>'
          }
        }

        $(table_id + ' > tbody').html(paired_content);
        if (button1) {
          this.enableFileButton(button1['name']);
        }
        if (button2) {
          this.enableFileButton(button2['name']);
        }
    }

    /**
     * Adds a function to the change event for the file button that
     * causes a new file to be added to this object which it is clicked.
     * The button is added by the updateUploadTable
     */
    this.enableFileButton = function(button_name) {
        // When the button provided by the TripalUploader class is clicked
        // then we need to add the files to the object.  We must have this
        // function so that we can set the proper URL
        var self = this;

        var func_name = ($.isFunction($.fn.live)) ? 'live' : 'on';
        $('#' + button_name)[func_name]('change', function(e) {
          var id = this.id;
          
          // Get the HTML5 list of files to upload.
          var hfiles = e.target.files;

          // Let the TripalUploader object parse the button ID to give us
          // the proper category name and index.
          var button = self.parseButtonID(id);
          var tname = button['tname'];
          var category = button['category'];
          var index = button['index'];

          // Add the file(s) to the uploader object.
          for (var i = 0; i < hfiles.length; i++) {
            var f = hfiles[i];
//            if (!f.name.match('^.*\.fastq$')){
//               alert('Only FastQ files are allowed.');
//               continue;
//            }
            var options = {
              // Files are managed by tables.
              'tname' : tname,
              // Files can be categorized to seprate them from other files.
              'category': category,
              // The index is the numeric index of the file. Files are ordered
              // by their index. The file with an index of 0 is always ordered first.
              'i': index,
              // The URL at the remote server where the file will uploaded. 
              'url' : '/tripal/upload/' + category,
            };
            self.addFile(f, options);

            // We need to update the upload table and the progress. The
            // information for which table to update is in the self.tables
            // array.
            self.updateTable(category);
          }
        });
    }
  };

  // Export the objects to the window for use in other JS files.
  window.TripalUploader = TripalUploader;

})(jQuery);