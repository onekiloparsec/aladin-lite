#version 300 es
precision highp float;
precision highp sampler2D;
precision highp usampler2D;
precision highp isampler2D;
precision highp int;

in vec2 out_clip_pos;
in vec3 frag_pos;
out vec4 out_frag_color;

struct Tile {
    int uniq; // Healpix cell
    int texture_idx; // Index in the texture buffer
    float start_time; // Absolute time that the load has been done in ms
    float empty;
};

uniform Tile textures_tiles[12];
uniform int num_tiles;

@include "../color.glsl"
@include "./healpix.glsl"

uniform float opacity;
/*
int binary_search_tile(int uniq) {
    int l = 0;
    int r = num_tiles - 1;

    while (l < r) {
        int a = (l + r) / 2;
        Tile tile = textures_tiles[a];
        if(tile.uniq == uniq) {
            return a;
        } else if(tile.uniq < uniq) {
            l = a + 1;
        } else {
            r = a - 1;
        }
    }

    return l;
}
*/
vec4 get_tile_color(vec3 pos) {
    HashDxDy result = hash_with_dxdy(0, pos.zxy);

    int idx = result.idx;
    vec2 uv = vec2(result.dy, result.dx);

    //int uniq = (16 << (d << 1)) | idx;
    //int tile_idx = binary_search_tile(uniq);
    Tile tile = textures_tiles[idx];

    //if(tile.uniq == uniq) {
        int idx_texture = tile.texture_idx >> 6;
        int off = tile.texture_idx & 0x3F;
        float idx_row = float(off >> 3); // in [0; 7]
        float idx_col = float(off & 0x7); // in [0; 7]

        vec2 offset = (vec2(idx_col, idx_row) + uv)*0.125;
        vec3 UV = vec3(offset, float(idx_texture));

        vec4 color = get_color_from_texture(UV);
        // For empty tiles we set the alpha of the pixel to 0.0
        // so that what is behind will be plotted
        //color.a *= (1.0 - tile.empty);

        return color;
    //}
}

uniform sampler2D position_tex;
uniform mat4 model;

void main() {
    vec2 uv = out_clip_pos * 0.5 + 0.5;
    //vec3 n = texture(position_tex, uv).rgb;
    //vec3 n = normalize(out_world_pos);
    /*} else {
        float x = out_clip_pos.x;
        float y = out_clip_pos.y;
        float x2 = x*x;
        float y2 = y*y;
        float x4 = x2*x2;
        float y4 = y2*y2;

        n = vec3(
            -x,
            y,
            -0.5*x2 - 0.5*y2 + 1.0
        );
    }*/

    //vec3 frag_pos = vec3(model * vec4(n, 1.0));

    // Get the HEALPix cell idx and the uv in the texture
    vec4 c = get_tile_color(normalize(frag_pos));
    out_frag_color = vec4(c.rgb, opacity * c.a);
}