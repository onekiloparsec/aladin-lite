#version 300 es
precision highp float;

out vec4 c;
in vec2 pos_clip;

uniform vec4 color;
uniform mat4 model;
uniform mat4 inv_model;
uniform mat4 to_icrs;
uniform mat4 to_galactic;
uniform float czf;

uniform float meridians[20];
uniform int num_meridians;
uniform float parallels[10];
uniform int num_parallels;

uniform vec2 window_size;

@include "../hips/projection.glsl"

bool is_included_inside_projection(vec2 pos_clip_space) {
    float px2 = pos_clip_space.x * pos_clip_space.x;
    float py2 = pos_clip_space.y * pos_clip_space.y;

    return (px2 * 0.25 + py2) <= 0.25;
}

/// View to world space transformation
/// 
/// This returns a normalized vector along its first 3 dimensions.
/// Its fourth component is set to 1.
/// 
/// The Aitoff projection maps screen coordinates from [-pi; pi] x [-pi/2; pi/2]
/// 
/// # Arguments
/// 
/// * `x` - in normalized device coordinates between [-1; 1]
/// * `y` - in normalized device coordinates between [-1; 1]
vec3 clip2world_mollweide(vec2 pos_clip_space) {
    if (!is_included_inside_projection(pos_clip_space)) {
        discard;
    }

    float y2 = pos_clip_space.y * pos_clip_space.y;
    float k = sqrt(1.0 - 4.0 * y2);

    float theta = PI * pos_clip_space.x / k;
    float delta = asin((2.0 * asin(2.0 * pos_clip_space.y) + 4.0 * pos_clip_space.y * k) / PI);
    
    // The minus is an astronomical convention.
    // longitudes are increasing from right to left
    return vec3(sin(theta) * cos(delta), sin(delta), cos(theta) * cos(delta));
}

float d_isolon(vec3 pos_model, float theta) {
    vec3 n = vec3(cos(theta), 0.0, -sin(theta));
    // Discard the (theta + PI) meridian
    vec3 e_xz = vec3(-n.z, 0.0, n.x);
    if (dot(pos_model, e_xz) < 0.0) {
        return 1e3;
    }

    float d = abs(dot(n, pos_model));

    vec3 h_model = normalize(pos_model - n*d);
    vec3 h_world = vec3(inv_model * to_icrs * vec4(h_model, 1.f));
    h_world = check_inversed_longitude(h_world);

    // Project to screen x and h and compute the distance
    // between the two
    vec2 h_clip = world2clip_mollweide(h_world);
    
    return length(pos_clip - h_clip) * 2.0;
}
float d_isolat(vec3 pos_model, float delta) {
    float y = atan(pos_model.y, length(pos_model.xz));
    float d = abs(y - delta);
    return d;
}

float grid_alpha(vec3 p) {
    float v = 1e10;
    float delta = asin(p.y);
    float theta = atan(p.x, p.z);

    float m = 0.0;
    float mdist = 10.0;
    for (int i = 0; i < num_meridians; i++) {
        float tmp = meridians[i];
        if (tmp > PI) {
            tmp -= 2.0 * PI;
        }
        float d = abs(theta - tmp);
        if (d < mdist) {
            mdist = d;
            m = tmp;
        }
    }

    float par = 0.0;
    float pdist = 10.0;
    for (int i = 0; i < num_parallels; i++) {
        float d = abs(delta - parallels[i]);
        if (d < pdist) {
            pdist = d;
            par = parallels[i];
        }
    }

    /*float a = 0.0;
    if (mdist < pdist) {
        a = d_isolon(p, m);
    } else {
        a = d_isolat(p, par);
    }
    v = min(a, v);*/
    v = min(d_isolon(p, m), v);
    v = min(d_isolat(p, par), v);

    float eps = 3.0 * czf / window_size.x;
    return smoothstep(eps, 2.0*eps, v);
}

void main() {
    vec4 transparency = vec4(0.f, 0.f, 0.f, 0.f);

    vec3 pos_world = clip2world_mollweide(pos_clip);
    pos_world = check_inversed_longitude(pos_world);

    vec3 pos_model = vec3(to_galactic * model * vec4(pos_world, 1.f));

    float alpha = grid_alpha(pos_model);
    c = mix(color, transparency, alpha);
}