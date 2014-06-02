/**
 * @file
 * @brief Clip directives (draggable & resizable functionality) 
 * @author Jonathan Thomas <jonathan@openshot.org>
 * @author Cody Parker <cody@yourcodepro.com>
 *
 * @section LICENSE
 *
 * Copyright (c) 2008-2014 OpenShot Studios, LLC
 * <http://www.openshotstudios.com/>. This file is part of
 * OpenShot Video Editor, an open-source project dedicated to
 * delivering high quality video editing and animation solutions to the
 * world. For more information visit <http://www.openshot.org/>.
 *
 * OpenShot Video Editor is free software: you can redistribute it
 * and/or modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * OpenShot Video Editor is distributed in the hope that it will be
 * useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with OpenShot Library.  If not, see <http://www.gnu.org/licenses/>.
 */


// Init variables
var dragging = false;
var previous_drag_position = null;
var start_clips = {};
var move_clips = {};
var bounding_box = Object();
var out_of_bounds = false;

// Variables for resizing clips
var last_resizable = { left: 0, width: 0 };

// Build bounding box (since multiple clips can be selected)
function setBoundingBox(clip){
	var vert_scroll_offset = $("#scrolling_tracks").scrollTop();
	var horz_scroll_offset = $("#scrolling_tracks").scrollLeft();
	
    var clip_bottom = clip.position().top + clip.height() + vert_scroll_offset;
    var clip_top = clip.position().top + vert_scroll_offset;
    var clip_left = clip.position().left + horz_scroll_offset;

    if(jQuery.isEmptyObject(bounding_box)){
        bounding_box.left = clip_left;
        bounding_box.top = clip_top;
        bounding_box.bottom = clip_bottom;
    }else{
        //compare and change if clip is a better fit for bounding box edges
        if (clip_top < bounding_box.top) bounding_box.top = clip_top;
        if (clip_left < bounding_box.left) bounding_box.left = clip_left;
        if (clip_bottom > bounding_box.bottom) bounding_box.bottom = clip_bottom;
    }
}


// Treats element as a clip
// 1: can be dragged
// 2: can be resized
// 3: class change when hovered over
var dragLog = null;

App.directive('tlClip', function($timeout){
	return {
		scope: "@",
		link: function(scope, element, attrs){

			$timeout(function(){
				//clip_tops["clip_"+scope.clip.id] = element.position().top;
				//clip_lefts["clip_"+scope.clip.id] = element.position().left;
			
				//if clip has audio data, show it instead of images
				if (scope.clip.show_audio){
					drawAudio(scope, scope.clip.id);
				}
				
			},0);

			//handle resizability of clip
			element.resizable({ 
				handles: "e, w",
				maxWidth: scope.clip.duration * scope.pixelsPerSecond,
				start: function(e, ui) {
					dragging = true;
					
					//determine which side is being changed
					var parentOffset = element.offset(); 
					var mouseLoc = e.pageX - parentOffset.left;
					if (mouseLoc < 5) {
						dragLoc = 'left';
					} else {
						dragLoc = 'right';
					}

					//hide audio canvas, as we'll need to redraw it
					element.find(".audio-container").hide();

					//hide the image container while it resizes
					//element.find(".thumb-container").hide();
					//element.find(".clip_top").hide();

				},
				stop: function(e, ui) {
					dragging = false;
					//get amount changed in width
					var delta_x = ui.originalSize.width - last_resizable.width;
					var delta_time = Math.round(delta_x/scope.pixelsPerSecond);

					//change the clip end/start based on which side was dragged
					new_left = scope.clip.start;
					new_right = scope.clip.end;

					if (dragLoc == 'left'){
						//changing the start of the clip
						new_left += delta_time;
						if (new_left < 0) new_left = 0; // prevent less than zero

					} else {
						//changing the end of the clips
						new_right -= delta_time;
						if (new_right > scope.clip.duration) new_right = scope.clip.duration;
					}

					//apply the new start, end and length to the clip's scope
					scope.$apply(function(){
	
						if (scope.clip.end != new_right){
							scope.clip.end = new_right;
						}
						if (scope.clip.start != new_left){
							scope.clip.start = new_left;
							scope.clip.position += delta_time;
						}
						
						// update clip in Qt (very important =)
            			if (scope.Qt)
            				timeline.update_clip_data(JSON.stringify(scope.clip));

					});

					//resize the audio canvas to match the new clip width
					if (scope.clip.show_audio){
						element.find(".audio-container").show();
						//redraw audio as the resize cleared the canvas
						drawAudio(scope, scope.clip.id);
					}
				
					dragLoc = null;

				},
				resize: function(e, ui) {
					
					// get amount changed in width
					var delta_x = ui.originalSize.width - ui.size.width;
					var delta_time = Math.round(delta_x/scope.pixelsPerSecond);

					// change the clip end/start based on which side was dragged
					new_left = scope.clip.start;
					new_right = scope.clip.end;

					if (dragLoc == 'left'){
						// changing the start of the clip
						new_left += delta_time;
						if (new_left < 0) { 
							ui.element.width(last_resizable.width + (new_left * scope.pixelsPerSecond));
							ui.element.css("left", last_resizable.left - (new_left * scope.pixelsPerSecond));
						}
						console.log("new_left" + new_left);
					} else {
						// changing the end of the clips
						new_right -= delta_time;
						if (new_right > scope.clip.duration) {
							new_right = scope.clip.duration - new_right;
							ui.element.width(last_resizable.width + (new_right * scope.pixelsPerSecond));
						}
					}

					// Set last_resizable
					last_resizable.left = ui.position.left;
					last_resizable.width = ui.size.width;
					
					//show or hide elements based on size
					//drawAudio(scope, scope.clip.id);
					handleVisibleClipElements(scope, scope.clip.id);
					
				},

			});
	
			//handle hover over on the clip
			element.hover(
	  			function () {
				  	if (!dragging)
				  	{
					  	element.addClass( "highlight_clip", 400, "easeInOutCubic" );
				  	}
			  	},
			  	function () {
				  	if (!dragging)
				  	{
					  	element.removeClass( "highlight_clip", 400, "easeInOutCubic" );
					}
			  	}
			);
			

			//handle draggability of clip
			element.draggable({
		        //revert: true, //reverts back to original place if not dropped
		        snap: ".track", // snaps to a track
		        snapMode: "inner", 
		        snapTolerance: 20, 
		        stack: ".droppable", 
		        containment:'#scrolling_tracks',
		        scroll: false,
		        revert: 'invalid',
		        start: function(event, ui) {
		        	previous_drag_position = null;
		        	dragging = true;
		        	if (!element.hasClass('ui-selected')){
		        		element.addClass('ui-selected');
		        	}
		        	
	            	var vert_scroll_offset = $("#scrolling_tracks").scrollTop();
	            	var horz_scroll_offset = $("#scrolling_tracks").scrollLeft();

                    bounding_box = {};

		        	// Init all other selected clips (prepare to drag them)
		        	$(".ui-selected").each(function(){
		        		start_clips[$(this).attr('id')] = {"top": $(this).position().top + vert_scroll_offset,
                                						   "left": $(this).position().left + horz_scroll_offset};
                        move_clips[$(this).attr('id')] = {"top": $(this).position().top + vert_scroll_offset,
                               							  "left": $(this).position().left + horz_scroll_offset};

                        //send clip to bounding box builder
                        setBoundingBox($(this));
                    });
		        	
		        },
                stop: function(event, ui) {
                	// Clear previous drag position
					previous_drag_position = null;
					dragging = false;

					//redraw audio
					if (scope.clip.show_audio){
						drawAudio(scope, scope.clip.id);
					}

				},
                drag: function(e, ui) {
                	var previous_x = ui.originalPosition.left;
					var previous_y = ui.originalPosition.top;
					if (previous_drag_position)
					{
						// if available, override with previous drag position
						previous_x = previous_drag_position.left;
						previous_y = previous_drag_position.top;
					}

					// set previous position (for next time around)
					previous_drag_position = ui.position;

	            	// Calculate amount to move clips
	            	var x_offset = ui.position.left - previous_x;
	            	var y_offset = ui.position.top - previous_y;


                    //update the dragged clip location in the location arrays
					move_clips[element.attr('id')] = {"top": ui.position.top,
                                                      "left": ui.position.left};

                    //update box
                    bounding_box.left += x_offset;
                    bounding_box.top += y_offset;
                    
                    if (bounding_box.left < 0) {
                    	x_offset -= bounding_box.left;
                    	bounding_box.left = 0;
                		ui.position.left = previous_x + x_offset;
                		move_clips[element.attr('id')]["left"] = ui.position.left;
                    }
                    if (bounding_box.top < 0) {
                    	y_offset -= bounding_box.top;
                    	bounding_box.top = 0;
                		ui.position.top = previous_y + y_offset;
                		move_clips[element.attr('id')]["top"] = ui.position.top;
                    }
                    	
    				// Move all other selected clips with this one
	                $(".ui-selected").not($(this)).each(function(){
	                	var pos = $(this).position();
	                	var newY = move_clips[$(this).attr('id')]["top"] + y_offset;
                        var newX = move_clips[$(this).attr('id')]["left"] + x_offset;

						//update the clip location in the array
	                	move_clips[$(this).attr('id')]['top'] = newY;
                        move_clips[$(this).attr('id')]['left'] = newX;

						//change the element location
						$(this).css('left', newX);
				    	$(this).css('top', newY);

				    });

                },
                revert: function(valid) {
                    if(!valid) {
                        //the drop spot was invalid, so we're going to move all clips to their original position
                        $(".ui-selected").each(function(){
                        	var oldY = start_clips[$(this).attr('id')]['top'];
                        	var oldX = start_clips[$(this).attr('id')]['left'];

                        	$(this).css('left', oldX);
				    		$(this).css('top', oldY);
                        });
                    }
                    return false;
                }
		      });


		}
	};
});

// Handle clip effects
App.directive('tlClipEffects', function(){
	return{
		link: function(scope, element, attrs){

		}
	};
});

// Handle multiple selections
App.directive('tlMultiSelectable', function(){
	return {
		link: function(scope, element, attrs){
			element.selectable({
				filter: '.droppable',
			});
		}
	};
});




