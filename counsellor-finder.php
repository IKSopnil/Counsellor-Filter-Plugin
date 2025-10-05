<?php
/*
Plugin Name: Counsellor Finder
Description: Manage and display counsellors with filters (specialties, client groups, and locations).
Version: 1.1.0
Author: You
*/

if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Register Custom Post Type
 */
function cf_register_counsellor_cpt() {
    register_post_type('counsellor', [
        'label' => 'Counsellors',
        'public' => true,
        'show_in_rest' => true,
        'supports' => ['title','editor','excerpt','thumbnail'],
        'menu_icon' => 'dashicons-businessman'
    ]);
}
add_action('init','cf_register_counsellor_cpt');

/**
 * Register Taxonomies
 */
function cf_register_taxonomies() {
    $taxonomies = [
        'specialty' => 'Specialties',
        'client_group' => 'Client Groups',
        'location' => 'Locations',
    ];
    foreach($taxonomies as $slug => $name){
        register_taxonomy($slug,'counsellor',[
            'labels' => ['name'=>$name],
            'hierarchical' => true,
            'show_admin_column'=>true,
            'show_in_rest'=>true,
        ]);
    }
}
add_action('init','cf_register_taxonomies');

/**
 * Metabox: Email and Phone
 */
function cf_add_metaboxes(){
    add_meta_box('cf_details','Counsellor Details','cf_render_metabox','counsellor','normal','default');
}
add_action('add_meta_boxes','cf_add_metaboxes');

function cf_render_metabox($post){
    $email = get_post_meta($post->ID,'cf_email',true);
    $phone = get_post_meta($post->ID,'cf_phone',true);
    ?>
    <p><label>Email<br>
    <input type="email" name="cf_email" value="<?php echo esc_attr($email); ?>" style="width:100%"></label></p>
    <p><label>Phone<br>
    <input type="text" name="cf_phone" value="<?php echo esc_attr($phone); ?>" style="width:100%"></label></p>
    <?php
}

function cf_save_metabox($post_id){
    if(isset($_POST['cf_email'])){
        update_post_meta($post_id,'cf_email',sanitize_email($_POST['cf_email']));
    }
    if(isset($_POST['cf_phone'])){
        update_post_meta($post_id,'cf_phone',sanitize_text_field($_POST['cf_phone']));
    }
}
add_action('save_post_counsellor','cf_save_metabox');

/**
 * REST API Endpoint
 */
function cf_rest_get_counsellors($request){
    $args = ['post_type'=>'counsellor','posts_per_page'=>-1];
    $tax_query=[];
    foreach(['specialty','client_group','location'] as $tax){
        if(!empty($request[$tax])){
            $tax_query[]=[
                'taxonomy'=>$tax,
                'field'=>'term_id',
                'terms'=>intval($request[$tax])
            ];
        }
    }
    if($tax_query) $args['tax_query']=$tax_query;

    $query=new WP_Query($args);
    $data=['counsellors'=>[],'terms'=>['specialty'=>[],'client_group'=>[],'location'=>[]]];

    while($query->have_posts()){
        $query->the_post();
        $id=get_the_ID();

        $c=[
            'id'=>$id,
            'title'=>get_the_title(),
            'content'=>get_the_excerpt(),
            'permalink'=>get_permalink(),
            'thumbnail'=>get_the_post_thumbnail_url($id,'medium'),
            'email'=>get_post_meta($id,'cf_email',true),
            'phone'=>get_post_meta($id,'cf_phone',true),
            'specialties'=>wp_get_post_terms($id,'specialty',['fields'=>'names']),
            'client_groups'=>wp_get_post_terms($id,'client_group',['fields'=>'names']),
            'locations'=>wp_get_post_terms($id,'location',['fields'=>'names']),
        ];
        $data['counsellors'][]=$c;

        // Collect available term IDs
        foreach(['specialty','client_group','location'] as $tax){
            $ids = wp_get_post_terms($id,$tax,['fields'=>'ids']);
            $data['terms'][$tax] = array_merge($data['terms'][$tax],$ids);
        }
    }
    wp_reset_postdata();

    // Deduplicate term IDs
    foreach(['specialty','client_group','location'] as $tax){
        $data['terms'][$tax] = array_unique($data['terms'][$tax]);
    }

    return $data;
}
add_action('rest_api_init', function(){
    register_rest_route('counsellor-finder/v1','counsellors',[
        'methods'=>'GET',
        'callback'=>'cf_rest_get_counsellors',
        'permission_callback'=>'__return_true'
    ]);
});

/**
 * Enqueue frontend assets
 */
function cf_enqueue_assets() {
    wp_enqueue_style('cf-frontend',plugin_dir_url(__FILE__).'assets/css/frontend.css',[],time());
    wp_enqueue_script('cf-frontend',plugin_dir_url(__FILE__).'assets/frontend.js',['jquery'],time(),true);
    wp_localize_script('cf-frontend','cfData',[
        'restUrl'=>esc_url(rest_url('counsellor-finder/v1/')),
        'nonce'=>wp_create_nonce('wp_rest')
    ]);
}
add_action('wp_enqueue_scripts','cf_enqueue_assets');

/**
 * Shortcode: [counsellor_finder]
 */
function cf_shortcode() {
    ob_start(); ?>
    <div id="counsellor-finder">
      <div class="filters">
        <label>Specialty:
          <select id="specialty-filter"><option value="">All</option></select>
        </label>
        <label>To Help…:
          <select id="client_group-filter"><option value="">All</option></select>
        </label>
        <label>Location:
          <select id="location-filter"><option value="">All</option></select>
        </label>
      </div>
      <div id="counsellor-results" class="counsellor-grid"></div>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('counsellor_finder','cf_shortcode');
